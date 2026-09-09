// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { calendarBrowseUrl } from '@/lib/calendar-navigation';
import { displayCache } from '@/lib/display-cache';
import { DEFAULT_MODULE_STYLE, type CalendarEvent, type FullscreenCalendarConfig } from '@/types/config';
import { installResizeObserverStub, I18nWrapper } from '../../__tests__/helpers/harness';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/hooks/useTZClock', () => ({ useTZClock: () => new Date(2026, 8, 7, 19) }));
vi.mock('@/lib/display-fetch', () => ({ displayFetch: mocks.fetch }));
vi.mock('../useCalendarExtras', async () => {
  const { EMPTY_EXTRAS } = await import('@/lib/calendar-extras');
  return { useCalendarExtras: () => EMPTY_EXTRAS };
});

installResizeObserverStub();
import CalendarDisplayModule from '../InteractiveCalendarModule';

const config = {
  interactiveNavigation: true, view: 'month-grid', startDay: 'sunday',
  density: 'cozy', typographySize: 'medium', dayHourStart: 0, dayHourEnd: 24,
  showNowLine: true, showLegend: 'header', eventTapDetails: true,
} as FullscreenCalendarConfig;
const props = { config, style: DEFAULT_MODULE_STYLE, timezone: 'America/Chicago' };
const events: CalendarEvent[] = [
  { id: 'today', title: 'Today pickup', allDay: false, start: '2026-09-07T19:00:00-05:00', end: '2026-09-07T20:00:00-05:00', sourceId: 'today-source', sourceName: 'Today calendar' },
  { id: 'selected', title: 'Piano practice', allDay: false, start: '2026-09-15T09:00:00-05:00', end: '2026-09-15T10:00:00-05:00', sourceId: 'music', sourceName: 'Music calendar' },
];

beforeEach(() => {
  displayCache.clear();
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ events, sourceStatus: [] }) });
});
afterEach(cleanup);

describe('month date opens day view', () => {
  it('opens the clicked event date, fetches that day, and keeps day/week/month navigation', async () => {
    const { container } = render(<CalendarDisplayModule {...props} />, { wrapper: I18nWrapper });
    const cell = await screen.findByRole('gridcell', { name: /^September 15,/ });
    // Event taps inside the cell open its date; details remain available in Day.
    fireEvent.click(cell.querySelector('[data-event-id="selected"]')!);
    await screen.findByLabelText('Day timeline');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tuesday, September 15');
    expect(screen.getByRole('button', { name: 'Day' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Piano practice')).toBeTruthy();
    expect(screen.queryByText('Today pickup')).toBeNull();
    expect(screen.getByText('Music calendar')).toBeTruthy();
    expect(screen.queryByText('Today calendar')).toBeNull();
    expect(container.querySelector('[aria-label^="Current time:"]')).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledWith(calendarBrowseUrl(new Date(2026, 8, 15), 'day', 'sunday'), expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    await screen.findByLabelText('Day timeline');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Wednesday, September 16');
    expect(screen.queryByText('Piano practice')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    await screen.findByText('Piano practice');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await screen.findByText('Today pickup');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Monday, September 7');
    expect(container.querySelector('[aria-label^="Current time:"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    await screen.findByRole('grid', { name: 'Schedule time grid' });
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    await screen.findByRole('grid', { name: 'September 2026' });
    expect(mocks.fetch.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true);
  });

  it.each(['Enter', ' '])('opens empty spillover dates with %s, without activating screen navigation', async (key) => {
    const outerClick = vi.fn();
    const outerKey = vi.fn();
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ events: [], sourceStatus: [] }) });
    render(<div onClick={outerClick} onKeyDown={outerKey}><CalendarDisplayModule {...props} /></div>, { wrapper: I18nWrapper });
    const cell = await screen.findByRole('gridcell', { name: /^October 1,/ });
    expect(cell.tabIndex).toBe(0);
    expect(cell.hasAttribute('data-swipe-ignore')).toBe(true);
    expect(screen.getByRole('navigation').hasAttribute('data-swipe-ignore')).toBe(true);
    cell.focus();
    fireEvent.keyDown(cell, { key });
    await screen.findByLabelText('Day timeline');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Thursday, October 1');
    expect(outerClick).not.toHaveBeenCalled();
    expect(outerKey).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledWith(calendarBrowseUrl(new Date(2026, 9, 1), 'day', 'sunday'), expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    await screen.findByRole('grid', { name: 'October 2026' });
  });

  it('shows failure after selecting a day when its fetch fails', async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events, sourceStatus: [] }) })
      .mockRejectedValue(new Error('offline'));
    render(<CalendarDisplayModule {...props} />, { wrapper: I18nWrapper });
    fireEvent.click(await screen.findByRole('gridcell', { name: /^September 15,/ }));
    await waitFor(() => expect(screen.getByText(/can.t load events/i)).toBeTruthy());
    expect(screen.queryByText('Piano practice')).toBeNull();
    expect(screen.queryByLabelText('Day timeline')).toBeNull();
  });
});
