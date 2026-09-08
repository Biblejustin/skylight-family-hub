import { describe, expect, it, vi } from 'vitest';
import type { ChoreDefinition } from '@/types/config';
import type { TranslateFn } from '@/i18n';
import { buildChoreSummaryLine, getChoreValidationHintKind } from '../chore-form-presentation';

const validForm: Parameters<typeof getChoreValidationHintKind>[0] = {
  name: 'Water plants',
  rotation: 'fixed',
  scheduleHasAssignment: false,
  assigneeIdsLength: 1,
  frequency: 'interval',
  intervalDays: 3,
  anchorDate: '2026-09-07',
};

describe('interval chore form presentation', () => {
  it('summarizes interval count, first date, time of day, and points', () => {
    const chore: ChoreDefinition = {
      id: 'interval-chore',
      name: 'Water plants',
      emoji: '',
      points: 2,
      frequency: 'interval',
      intervalDays: 3,
      anchorDate: '2026-09-07',
      daysOfWeek: [],
      timeOfDay: 'evening',
      assigneeIds: ['alice'],
      rotation: 'fixed',
    };
    const t = vi.fn<TranslateFn>((key) => key);

    const summary = buildChoreSummaryLine({ chore, t });

    expect(t).toHaveBeenCalledWith('chore-chart.choreSummary.interval', {
      count: 3,
      date: '2026-09-07',
    });
    expect(t).toHaveBeenCalledWith('chore-chart.timeOfDay.evening');
    expect(t).toHaveBeenCalledWith('chore-chart.choreSummary.ticketCountPlural', { count: 2 });
    expect(summary).toBe(
      'chore-chart.choreSummary.interval · chore-chart.timeOfDay.evening · chore-chart.choreSummary.ticketCountPlural',
    );
  });

  it.each([1, 3, 14])('accepts a valid interval of %s days', (intervalDays) => {
    expect(getChoreValidationHintKind({ ...validForm, intervalDays })).toBeNull();
  });

  it.each([undefined, 0, -3, 1.5, Number.NaN])
    ('shows invalidInterval for intervalDays %s', (intervalDays) => {
      expect(getChoreValidationHintKind({ ...validForm, intervalDays })).toBe('invalidInterval');
    });

  it.each([undefined, '', '2026-02-29', '2026-04-31', '2026-9-07'])
    ('shows invalidInterval for anchorDate %s', (anchorDate) => {
      expect(getChoreValidationHintKind({ ...validForm, anchorDate })).toBe('invalidInterval');
    });

  it.each([undefined, 'daily', 'weekly', 'biweekly', 'once'] as const)
    ('does not require interval fields for legacy frequency %s', (frequency) => {
      expect(getChoreValidationHintKind({
        ...validForm,
        frequency,
        intervalDays: undefined,
        anchorDate: undefined,
      })).toBeNull();
    });
});
