// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FullscreenCalendarConfig, ModuleStyle } from '@/types/config';
import { calendarBrowseUrl } from '@/lib/calendar-navigation';
import { displayCache } from '@/lib/display-cache';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), t: (key: string) => key }));
vi.mock('@/i18n', () => ({ useTranslate: () => mocks.t }));
vi.mock('@/hooks/useTZClock', () => ({ useTZClock: () => new Date(2026, 8, 7, 19) }));
vi.mock('@/lib/display-fetch', () => ({ displayFetch: mocks.fetch }));
vi.mock('../FullscreenCalendarModule', () => ({
  default: (props: {
    config: FullscreenCalendarConfig; viewDate?: Date; navigation?: React.ReactNode;
    events?: { title: string }[]; loading?: boolean; calendarStatus?: { error: string | null };
  }) => <div>
    {props.navigation}
    <output data-testid="view">{props.config.view}</output>
    <output data-testid="date">{props.viewDate?.toISOString()}</output>
    {props.loading ? <p>Loading range</p> : props.calendarStatus?.error ? <p>Range unavailable</p> : <p>Range loaded</p>}
    {props.events?.map((event, i) => <p key={i}>{event.title}</p>)}
  </div>,
}));

import CalendarDisplayModule from '../InteractiveCalendarModule';

const config = { interactiveNavigation: true, view: 'schedule', startDay: 'sunday' } as FullscreenCalendarConfig;
const props = { config, style: {} as ModuleStyle, timezone: 'America/Chicago' };
const response = (title?: string) => ({ ok: true, json: async () => ({ events: title ? [{ title }] : [], sourceStatus: [] }) });

beforeEach(() => { displayCache.clear(); mocks.fetch.mockReset(); mocks.fetch.mockResolvedValue(response()); });
afterEach(() => cleanup());

describe('touch calendar navigation', () => {
  it('toggles week/month, browses both directions, and returns to today', async () => {
    render(<CalendarDisplayModule {...props} />);
    await screen.findByText('Range loaded');
    expect(screen.getByTestId('view').textContent).toBe('schedule');
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(screen.getByTestId('date').textContent).toBe(new Date(2026, 8, 14).toISOString()));
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByTestId('view').textContent).toBe('month-grid');
    expect(screen.getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByTestId('date').textContent).toBe(new Date(2026, 9, 1).toISOString());
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByTestId('date').textContent).toBe(new Date(2026, 8, 1).toISOString());
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('date').textContent).toBe(new Date(2026, 8, 7).toISOString());
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByTestId('date').textContent).toBe(new Date(2026, 7, 31).toISOString());
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith(calendarBrowseUrl(new Date(2026, 7, 31), 'week', 'sunday'), expect.anything()));
    expect(mocks.fetch.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true);
  });

  it('does not show the previous range as loaded when new range fails', async () => {
    mocks.fetch.mockResolvedValueOnce(response('Current week event')).mockRejectedValue(new Error('offline'));
    render(<CalendarDisplayModule {...props} />);
    await screen.findByText('Current week event');
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.queryByText('Current week event')).toBeNull();
    await screen.findByText('Range unavailable');
    expect(screen.queryByText('Range loaded')).toBeNull();
  });

  it('ignores an in-flight old response after rapid navigation', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue(response('New week event'));
    render(<CalendarDisplayModule {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await screen.findByText('New week event');
    resolveOld(response('Old week event'));
    await waitFor(() => expect(screen.queryByText('Old week event')).toBeNull());
    expect(screen.getByText('New week event')).toBeTruthy();
  });

  it('does not fetch or add controls to modules without opt-in', () => {
    render(<CalendarDisplayModule {...props} config={{ ...config, interactiveNavigation: false }} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
