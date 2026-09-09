'use client';

import { useCallback, useMemo, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { startOfDay } from 'date-fns';
import { useTZClock } from '@/hooks/useTZClock';
import { useFetchData } from '@/hooks/useFetchData';
import { CALENDAR_REFRESH_MS } from '@/lib/constants';
import { calendarBrowseUrl, moveCalendarDate, type CalendarBrowseView } from '@/lib/calendar-navigation';
import type { CalendarEvent, CalendarSourceStatus } from '@/types/config';
import FullscreenCalendarModule from './FullscreenCalendarModule';

type Props = ComponentProps<typeof FullscreenCalendarModule>;
interface CalendarPayload {
  events: CalendarEvent[];
  sourceStatus?: CalendarSourceStatus[];
}

/** Opt-in touch navigation. Browsing never changes the saved family layout. */
export default function CalendarDisplayModule(props: Props) {
  return props.config.interactiveNavigation
    ? <InteractiveCalendar {...props} />
    : <FullscreenCalendarModule {...props} />;
}

function InteractiveCalendar(props: Props) {
  const now = useTZClock(props.timezone);
  const todayMs = startOfDay(now).getTime();
  const today = useMemo(() => new Date(todayMs), [todayMs]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedView, setSelectedView] = useState<CalendarBrowseView | null>(null);
  const view = selectedView ?? (props.config.view === 'month-grid' ? 'month' : props.config.view === 'day-timeline' ? 'day' : 'week');
  const viewDate = selectedDate ?? today;
  const config = useMemo(() => ({
    ...props.config,
    view: view === 'month' ? 'month-grid' as const : view === 'day' ? 'day-timeline' as const : 'schedule' as const,
    scheduleDaysToShow: 7,
    scheduleStartAnchor: 'start-of-week' as const,
  }), [props.config, view]);
  const url = props.calendarSetup === 'noSources'
    ? '' : calendarBrowseUrl(viewDate, view, config.startDay);
  const navigate = (direction: -1 | 1) => setSelectedDate(date => moveCalendarDate(date ?? today, view, direction));
  const selectDay = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setSelectedView('day');
  }, []);
  const navigation = (
    <nav aria-label="Calendar navigation" data-swipe-ignore style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div role="group" aria-label="Calendar view" style={{ display: 'flex', gap: 3, marginRight: 6 }}>
        <NavButton pressed={view === 'day'} onClick={() => setSelectedView('day')}>Day</NavButton>
        <NavButton pressed={view === 'week'} onClick={() => setSelectedView('week')}>Week</NavButton>
        <NavButton pressed={view === 'month'} onClick={() => setSelectedView('month')}>Month</NavButton>
      </div>
      <NavButton label={`Previous ${view}`} onClick={() => navigate(-1)}>‹</NavButton>
      <NavButton onClick={() => setSelectedDate(null)}>Today</NavButton>
      <NavButton label={`Next ${view}`} onClick={() => navigate(1)}>›</NavButton>
    </nav>
  );
  // Remount only the range reader, so a response or last-good data for one
  // month can never be presented as a successful fetch of a different month.
  return <CalendarRange key={`${props.timezone}:${url}`} {...props} config={config} viewDate={viewDate} onSelectDate={selectDay} navigation={navigation} url={url} />;
}

function CalendarRange({ url, ...props }: Props & { url: string }) {
  const [data, error, updatedAt] = useFetchData<CalendarPayload>(url, CALENDAR_REFRESH_MS);
  return (
    <FullscreenCalendarModule
      {...props}
      events={data?.events ?? []}
      loading={Boolean(url) && data === null && error === null}
      calendarStatus={{ error: error?.message ?? null, updatedAt }}
      sourceStatus={data?.sourceStatus}
    />
  );
}

function NavButton({ children, label, pressed, onClick }: {
  children: ReactNode; label?: string; pressed?: boolean; onClick: () => void;
}) {
  const style: CSSProperties = {
    minWidth: 44, minHeight: 44, padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--cal-border)', cursor: 'pointer', touchAction: 'manipulation',
    fontSize: 15, fontWeight: 600, lineHeight: 1,
    background: pressed ? 'var(--cal-accent)' : 'var(--cal-surface)',
    color: pressed ? 'var(--cal-on-accent)' : 'var(--cal-text-primary)',
  };
  return <button type="button" aria-label={label} aria-pressed={pressed} style={style} onClick={(event) => { event.stopPropagation(); onClick(); }}>{children}</button>;
}
