const MS_PER_DAY = 86_400_000;

/** Parse a real calendar date at UTC midnight, independent of local DST. */
function calendarDateUTC(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  const time = date.getTime();
  return Number.isFinite(time) && date.toISOString().slice(0, 10) === value ? time : null;
}

export function isValidChoreInterval(intervalDays: unknown, anchorDate: unknown): boolean {
  return typeof intervalDays === 'number'
    && Number.isSafeInteger(intervalDays)
    && intervalDays > 0
    && calendarDateUTC(anchorDate) !== null;
}

/** The anchor is due; later occurrences repeat every N calendar days. */
export function isIntervalChoreDue(date: string | undefined, intervalDays: unknown, anchorDate: unknown): boolean {
  if (!isValidChoreInterval(intervalDays, anchorDate)) return false;
  const current = calendarDateUTC(date);
  const anchor = calendarDateUTC(anchorDate);
  if (current === null || anchor === null) return false;
  const elapsedDays = (current - anchor) / MS_PER_DAY;
  return elapsedDays >= 0 && elapsedDays % (intervalDays as number) === 0;
}
