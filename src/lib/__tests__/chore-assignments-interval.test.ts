import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  choreAppliesToday,
  completionKey,
  isAssignedOn,
  resolveAssignmentsFor,
} from '@/lib/chore-assignments';
import type { ChoreDefinition, ChoreMember } from '@/types/config';

function intervalChore(overrides: Partial<ChoreDefinition> = {}): ChoreDefinition {
  return {
    id: 'interval-chore',
    name: 'Water plants',
    emoji: '',
    points: 3,
    frequency: 'interval',
    intervalDays: 3,
    anchorDate: '2026-09-07',
    daysOfWeek: [],
    timeOfDay: 'anytime',
    assigneeIds: ['alice'],
    rotation: 'fixed',
    ...overrides,
  };
}

describe('interval chore recurrence', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('starts on the anchor and repeats every three days', () => {
    const chore = intervalChore();
    const dates = [
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
      '2026-09-11', '2026-09-12', '2026-09-13',
    ];

    expect(dates.map((date) => isAssignedOn(chore, 'alice', date)))
      .toEqual([true, false, false, true, false, false, true]);
  });

  it('never schedules before the anchor, including an exact interval earlier', () => {
    const chore = intervalChore();
    expect(isAssignedOn(chore, 'alice', '2026-09-04')).toBe(false);
    expect(isAssignedOn(chore, 'alice', '2026-09-06')).toBe(false);
  });

  it('supports a one-day interval', () => {
    const chore = intervalChore({ intervalDays: 1 });
    expect(isAssignedOn(chore, 'alice', '2026-09-07')).toBe(true);
    expect(isAssignedOn(chore, 'alice', '2026-09-08')).toBe(true);
    expect(isAssignedOn(chore, 'alice', '2026-09-06')).toBe(false);
  });

  it.each([
    ['month boundary', '2026-09-29', '2026-10-02', '2026-10-01'],
    ['year boundary', '2026-12-30', '2027-01-02', '2027-01-01'],
    ['leap day', '2024-02-27', '2024-03-01', '2024-02-29'],
    ['leap-day anchor', '2024-02-29', '2024-03-03', '2024-03-02'],
    ['non-leap February', '2026-02-27', '2026-03-02', '2026-03-01'],
  ])('counts calendar days across %s', (_label, anchorDate, dueDate, offDate) => {
    const chore = intervalChore({ anchorDate });
    expect(isAssignedOn(chore, 'alice', dueDate)).toBe(true);
    expect(isAssignedOn(chore, 'alice', offDate)).toBe(false);
  });

  it.each([
    ['spring forward', '2026-03-07', '2026-03-10', '2026-03-09', 71],
    ['fall back', '2026-10-31', '2026-11-03', '2026-11-02', 73],
  ])('keeps the three-day schedule across Chicago %s', (_label, anchorDate, dueDate, offDate, hours) => {
    vi.stubEnv('TZ', 'America/Chicago');
    // These local midnights are three calendar days, but not 72 elapsed hours.
    const elapsedHours = (
      new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${anchorDate}T00:00:00`).getTime()
    ) / 3_600_000;
    expect(elapsedHours).toBe(hours);

    const chore = intervalChore({ anchorDate });
    expect(isAssignedOn(chore, 'alice', dueDate)).toBe(true);
    expect(isAssignedOn(chore, 'alice', offDate)).toBe(false);
  });

  it('ignores stored weekday filters without creating extra occurrences', () => {
    const chore = intervalChore({ daysOfWeek: [2] }); // Tuesday only in an older schedule.
    expect(choreAppliesToday(chore, 1, '2026-09-07')).toBe(true); // Monday anchor.
    expect(choreAppliesToday(chore, 4, '2026-09-10')).toBe(true); // Thursday occurrence.
    expect(choreAppliesToday(chore, 2, '2026-09-08')).toBe(false); // Tuesday off day.
  });

  it.each([undefined, null, 0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3'])
    ('rejects invalid intervalDays %s', (intervalDays) => {
      // Imported JSON can contain values outside the TypeScript contract.
      const chore = intervalChore({ intervalDays: intervalDays as number });
      expect(choreAppliesToday(chore, 1, '2026-09-07')).toBe(false);
      expect(choreAppliesToday(chore, 4, '2026-09-10')).toBe(false);
    });

  it.each([
    [undefined, '2026-09-07'],
    ['', '2026-09-07'],
    ['not-a-date', '2026-09-07'],
    ['2026-9-07', '2026-09-07'],
    ['2026-02-29', '2026-03-01'],
    ['2026-04-31', '2026-05-01'],
    ['2026-13-01', '2027-01-01'],
    ['2026-00-01', '2025-12-01'],
    ['2026-01-00', '2025-12-31'],
    ['2026-09-07T00:00:00Z', '2026-09-07'],
  ])('rejects invalid anchorDate %s instead of normalizing it', (anchorDate, date) => {
    const chore = intervalChore({ anchorDate });
    expect(choreAppliesToday(chore, 1, date)).toBe(false);
  });

  it.each([undefined, '', 'not-a-date', '2026-9-07', '2026-09-31'])
    ('does not schedule a missing or invalid requested date %s', (date) => {
      expect(choreAppliesToday(intervalChore(), 1, date)).toBe(false);
    });

  it('resolves only due assignments and preserves each occurrence completion', () => {
    const chore = intervalChore();
    const members: ChoreMember[] = [{ id: 'alice', name: 'Alice', emoji: '', color: '#60a5fa' }];
    const completions = new Set([completionKey(chore.id, 'alice', '2026-09-07')]);

    expect(resolveAssignmentsFor([chore], members, '2026-09-07', completions))
      .toEqual([{ chore, memberId: 'alice', isCompleted: true }]);
    expect(resolveAssignmentsFor([chore], members, '2026-09-08', completions)).toEqual([]);
    expect(resolveAssignmentsFor([chore], members, '2026-09-10', completions))
      .toEqual([{ chore, memberId: 'alice', isCompleted: false }]);
    expect(isAssignedOn(chore, 'bob', '2026-09-10')).toBe(false);
  });
});
