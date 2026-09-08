// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DEFAULT_MODULE_STYLE, type FullscreenCalendarConfig } from '@/types/config';
import type { CalendarEvent } from '../view-support';
import { installResizeObserverStub, I18nWrapper as Wrapper, testScale } from '../../__tests__/helpers/harness';

vi.mock('@/hooks/useTZClock', () => ({
  useTZClock: () => new Date(2026, 7, 24, 15, 40),
}));
// Module tests remain fully offline, including optional household feeds.
vi.mock('../useCalendarExtras', async () => {
  const { EMPTY_EXTRAS } = await import('@/lib/calendar-extras');
  return { useCalendarExtras: () => EMPTY_EXTRAS };
});

installResizeObserverStub();

import { ScheduleView } from '../ScheduleView';
import { MonthGridView } from '../MonthGridView';
import FullscreenCalendarModule from '../FullscreenCalendarModule';

const scale = testScale();
const today = new Date(2026, 7, 24);
const now = new Date(2026, 7, 24, 15, 40);
const futureDate = new Date(2026, 8, 16);
const scheduleConfig = {
  view: 'schedule',
  density: 'cozy',
  typographySize: 'medium',
  accentColor: '#EA580C',
  dimPastEvents: true,
  shadeWeekends: false,
  startDay: 'monday',
  scheduleStartAnchor: 'start-of-week',
  scheduleDaysToShow: 7,
  scheduleHourStart: 6,
  scheduleHourEnd: 22,
  showNowLine: true,
  showLegend: 'off',
} as FullscreenCalendarConfig;
const monthConfig = { ...scheduleConfig, view: 'month-grid' } as FullscreenCalendarConfig;
const events: CalendarEvent[] = [
  { id: 'current', title: 'Current week swim', allDay: false, start: '2026-08-24T16:00:00', end: '2026-08-24T17:00:00' },
  { id: 'future', title: 'September piano', allDay: false, start: '2026-09-15T16:00:00', end: '2026-09-15T17:00:00' },
];
const navigation = <nav aria-label="Calendar dates"><button type="button">Next</button></nav>;

afterEach(cleanup);

describe('ScheduleView date navigation', () => {
  it('renders the viewed week without moving today or drawing a current-time line in the future', () => {
    const { container, getByRole, queryByRole } = render(
      <ScheduleView events={events} config={scheduleConfig} scale={scale} today={today} now={now} viewDate={futureDate} />,
      { wrapper: Wrapper },
    );

    expect(getByRole('gridcell', { name: 'Monday, September 14' })).toBeTruthy();
    expect(getByRole('gridcell', { name: 'Tuesday, September 15' }).textContent).toContain('September piano');
    expect(queryByRole('gridcell', { name: 'Monday, August 24' })).toBeNull();
    expect(container.querySelector('[data-event-id="current"]')).toBeNull();
    expect(container.querySelector('.fsc-today-pulse')).toBeNull();
    expect(container.querySelector('[aria-label^="Current time:"]')).toBeNull();
  });

  it('keeps the real-today marker and current-time line when another date in this week is selected', () => {
    const { container } = render(
      <ScheduleView events={events} config={scheduleConfig} scale={scale} today={today} now={now} viewDate={new Date(2026, 7, 27)} />,
      { wrapper: Wrapper },
    );

    expect(container.querySelectorAll('.fsc-today-pulse')).toHaveLength(1);
    expect(container.querySelector('.fsc-today-pulse')?.textContent).toBe('24');
    expect(container.querySelector('[aria-label="Current time: 3:40 PM"]')).not.toBeNull();
  });

  it('defaults to the current week when viewDate is omitted', () => {
    const { container, getByRole } = render(
      <ScheduleView events={events} config={scheduleConfig} scale={scale} today={today} now={now} />,
      { wrapper: Wrapper },
    );

    expect(getByRole('gridcell', { name: 'Monday, August 24' }).textContent).toContain('Current week swim');
    expect(container.querySelector('[data-event-id="future"]')).toBeNull();
    expect(container.querySelector('.fsc-today-pulse')?.textContent).toBe('24');
    expect(container.querySelector('[aria-label="Current time: 3:40 PM"]')).not.toBeNull();
  });
});

describe('MonthGridView date navigation', () => {
  it('renders the viewed month and its events, with the correct outside-month shading', () => {
    const { container, getByRole } = render(
      <MonthGridView events={events} config={monthConfig} scale={scale} today={today} now={now} viewDate={futureDate} />,
      { wrapper: Wrapper },
    );

    expect(getByRole('grid', { name: 'September 2026' })).toBeTruthy();
    expect(getByRole('gridcell', { name: /^September 15,/ }).textContent).toContain('September piano');
    expect(getByRole('gridcell', { name: /^September 1,/ }).style.opacity).toBe('1');
    expect(getByRole('gridcell', { name: /^August 31,/ }).style.opacity).toBe('0.35');
    expect(container.querySelector('[data-event-id="current"]')).toBeNull();
    expect(container.querySelector('.fsc-today-pulse')).toBeNull();
  });

  it('marks real today when it appears in an adjacent-month cell', () => {
    const { container, getByRole } = render(
      <MonthGridView events={[]} config={monthConfig} scale={scale} today={new Date(2026, 7, 31)} now={new Date(2026, 7, 31, 15, 40)} viewDate={futureDate} />,
      { wrapper: Wrapper },
    );

    const actualToday = getByRole('gridcell', { name: /^August 31,/ });
    expect(actualToday.querySelector('.fsc-today-pulse')?.textContent).toBe('31');
    expect(container.querySelectorAll('.fsc-today-pulse')).toHaveLength(1);
    expect(getByRole('gridcell', { name: /^September 16,/ }).querySelector('.fsc-today-pulse')).toBeNull();
  });

  it('defaults to the current month when viewDate is omitted', () => {
    const { container, getByRole } = render(
      <MonthGridView events={events} config={monthConfig} scale={scale} today={today} now={now} />,
      { wrapper: Wrapper },
    );

    expect(getByRole('grid', { name: 'August 2026' })).toBeTruthy();
    expect(getByRole('gridcell', { name: /^August 24,/ }).textContent).toContain('Current week swim');
    expect(container.querySelector('[data-event-id="future"]')).toBeNull();
    expect(container.querySelector('.fsc-today-pulse')?.textContent).toBe('24');
  });
});

describe('FullscreenCalendarModule navigation with an empty feed', () => {
  it.each([
    { config: scheduleConfig, title: 'September 14 – 20, 2026', grid: 'Schedule time grid' },
    { config: monthConfig, title: 'September 2026', grid: 'September 2026' },
  ])('shows an empty $config.view grid and navigation after a successful fetch', ({ config, title, grid }) => {
    const { getByRole, container } = render(
      <FullscreenCalendarModule
        config={config} style={DEFAULT_MODULE_STYLE} events={[]} viewDate={futureDate} navigation={navigation}
        calendarStatus={{ error: null, updatedAt: now.getTime() }}
      />,
      { wrapper: Wrapper },
    );

    expect(getByRole('heading', { level: 1 }).textContent).toBe(title);
    expect(getByRole('navigation', { name: 'Calendar dates' })).toBeTruthy();
    expect(getByRole('grid', { name: grid })).toBeTruthy();
    expect(container.querySelector('.fsc-today-pulse')).toBeNull();
  });

  it('retains the existing empty state without navigation', () => {
    const { container, queryByRole } = render(
      <FullscreenCalendarModule config={monthConfig} style={DEFAULT_MODULE_STYLE} events={[]} calendarStatus={{ error: null, updatedAt: now.getTime() }} />,
      { wrapper: Wrapper },
    );

    expect(queryByRole('grid')).toBeNull();
    expect(container.textContent).toContain('No events this month');
  });

  it('keeps the loading skeleton before a successful fetch', () => {
    const { container, queryByRole } = render(
      <FullscreenCalendarModule config={monthConfig} style={DEFAULT_MODULE_STYLE} events={[]} viewDate={futureDate} navigation={navigation} loading />,
      { wrapper: Wrapper },
    );

    expect(queryByRole('grid')).toBeNull();
    expect(container.querySelectorAll('.fsc-skeleton').length).toBeGreaterThan(0);
  });

  it('keeps the setup card when no calendar sources are configured', () => {
    const { getByTestId, queryByRole } = render(
      <FullscreenCalendarModule config={monthConfig} style={DEFAULT_MODULE_STYLE} events={[]} viewDate={futureDate} navigation={navigation} calendarSetup="noSources" />,
      { wrapper: Wrapper },
    );

    expect(queryByRole('grid')).toBeNull();
    expect(getByTestId('calendar-setup-card').getAttribute('data-setup')).toBe('noSources');
  });

  it('keeps the failure state when a fetch has never succeeded', () => {
    const { container, queryByRole } = render(
      <FullscreenCalendarModule
        config={monthConfig} style={DEFAULT_MODULE_STYLE} events={[]} viewDate={futureDate} navigation={navigation}
        calendarStatus={{ error: 'Unavailable', updatedAt: null }}
      />,
      { wrapper: Wrapper },
    );

    expect(queryByRole('grid')).toBeNull();
    expect(container.textContent).toMatch(/can.t load events/i);
  });
});
