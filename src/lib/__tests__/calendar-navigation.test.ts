import { describe, expect, it } from 'vitest';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { calendarBrowseUrl, moveCalendarDate } from '../calendar-navigation';

describe('calendar browsing dates', () => {
  it('crosses short months and year boundaries without skipping a month', () => {
    const february = moveCalendarDate(new Date(2028, 0, 31), 'month', 1);
    expect([february.getMonth(), february.getDate()]).toEqual([1, 1]);
    const march = moveCalendarDate(february, 'month', 1);
    expect([march.getMonth(), march.getDate()]).toEqual([2, 1]);
    const december = moveCalendarDate(new Date(2027, 0, 31), 'month', -1);
    expect([december.getFullYear(), december.getMonth(), december.getDate()]).toEqual([2026, 11, 1]);
  });

  it('moves a calendar week across DST and returns to same day', () => {
    const start = new Date(2026, 9, 28, 17);
    const next = moveCalendarDate(start, 'week', 1);
    expect([next.getMonth(), next.getDate(), next.getHours()]).toEqual([10, 4, 0]);
    expect(moveCalendarDate(next, 'week', -1)).toEqual(new Date(2026, 9, 28));
  });

  it('moves one day across leap days and year boundaries', () => {
    expect(moveCalendarDate(new Date(2028, 1, 28, 19), 'day', 1)).toEqual(new Date(2028, 1, 29));
    expect(moveCalendarDate(new Date(2028, 1, 29), 'day', 1)).toEqual(new Date(2028, 2, 1));
    expect(moveCalendarDate(new Date(2027, 0, 1), 'day', -1)).toEqual(new Date(2026, 11, 31));
  });

  it('requests the selected day with timezone padding and a stable URL across its hours', () => {
    const day = new Date(2026, 8, 15);
    const url = new URL(calendarBrowseUrl(day, 'day', 'sunday'), 'http://hub');
    expect(new Date(url.searchParams.get('timeMin')!)).toEqual(new Date(2026, 8, 14));
    expect(new Date(url.searchParams.get('timeMax')!)).toEqual(new Date(2026, 8, 17));
    expect(calendarBrowseUrl(new Date(2026, 8, 15, 23), 'day', 'monday')).toBe(calendarBrowseUrl(day, 'day', 'sunday'));
    expect(calendarBrowseUrl(addDays(day, 1), 'day')).not.toBe(calendarBrowseUrl(day, 'day'));
  });

  it('requests a full six-row month including spillover cells and zone padding', () => {
    const url = new URL(calendarBrowseUrl(new Date(2026, 4, 15), 'month', 'sunday'), 'http://hub');
    const start = new Date(url.searchParams.get('timeMin')!);
    const end = new Date(url.searchParams.get('timeMax')!);
    expect(start).toEqual(new Date(2026, 3, 25));
    expect(end).toEqual(new Date(2026, 5, 8));
    expect(differenceInCalendarDays(end, start)).toBe(44);
    expect(url.searchParams.has('calendarIds')).toBe(false);
  });

  it('honors week start and has a stable URL within one displayed week', () => {
    const day = new Date(2026, 8, 9);
    expect(calendarBrowseUrl(day, 'week', 'sunday')).toBe(calendarBrowseUrl(addDays(day, 1), 'week', 'sunday'));
    const sunday = new URL(calendarBrowseUrl(day, 'week', 'sunday'), 'http://hub');
    const monday = new URL(calendarBrowseUrl(day, 'week', 'monday'), 'http://hub');
    expect(new Date(sunday.searchParams.get('timeMin')!)).toEqual(new Date(2026, 8, 5));
    expect(new Date(monday.searchParams.get('timeMin')!)).toEqual(new Date(2026, 8, 6));
  });
});
