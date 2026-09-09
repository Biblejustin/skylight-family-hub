import { addDays, addMonths, startOfDay, startOfMonth } from 'date-fns';
import { viewDayWindow } from '@/lib/calendar-legend';
import { weekStartsOnFor } from '@/lib/calendar-utils';
import type { WeekStartDay } from '@/types/config';

export type CalendarBrowseView = 'day' | 'week' | 'month';

/** Month navigation starts at day one so Jan 31 → Feb → Mar cannot drift. */
export function moveCalendarDate(date: Date, view: CalendarBrowseView, direction: -1 | 1): Date {
  return view === 'month'
    ? addMonths(startOfMonth(date), direction)
    : addDays(startOfDay(date), direction * (view === 'day' ? 1 : 7));
}

/** Fetch every visible cell, including the adjacent-month cells. Like the
 * shared calendar fetch, pad wall-clock dates for device/server zone offsets. */
export function calendarBrowseUrl(date: Date, view: CalendarBrowseView, startDay?: WeekStartDay): string {
  const window = viewDayWindow({
    kind: view === 'month' ? 'month-grid' : view === 'day' ? 'days' : 'week',
    today: startOfDay(date),
    weekStartsOn: weekStartsOnFor(startDay),
  });
  const params = new URLSearchParams({
    timeMin: addDays(window.start, -1).toISOString(),
    timeMax: addDays(window.end, 1).toISOString(),
  });
  return `/api/calendar?${params}`;
}
