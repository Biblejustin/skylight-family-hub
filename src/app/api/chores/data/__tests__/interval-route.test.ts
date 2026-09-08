import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ChoreDefinition, ChoreMember } from '@/types/config';

vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(),
  requireDisplayAuth: vi.fn(),
  isAuthEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/chore-data', () => ({
  readChoreData: vi.fn(),
  writeChoreData: vi.fn(),
}));

vi.mock('@/lib/reward-data', () => ({
  rewardCascadeDeleteMember: vi.fn().mockResolvedValue(undefined),
}));

import { PUT } from '@/app/api/chores/data/route';
import { readChoreData, writeChoreData } from '@/lib/chore-data';
import { rewardCascadeDeleteMember } from '@/lib/reward-data';

const members: ChoreMember[] = [{ id: 'alice', name: 'Alice', emoji: '', color: '#60a5fa' }];
const chore: ChoreDefinition = {
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
};

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chores/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readChoreData).mockResolvedValue({ members, chores: [chore] });
  vi.mocked(writeChoreData).mockResolvedValue(undefined);
});

describe('PUT /api/chores/data interval validation', () => {
  it.each([undefined, null, 0, -3, 1.5, '3', Number.MAX_SAFE_INTEGER + 1])
    ('rejects intervalDays %s before writing or deleting reward data', async (intervalDays) => {
      const response = await PUT(putRequest({
        members,
        chores: [{ ...chore, intervalDays }],
      }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(writeChoreData).not.toHaveBeenCalled();
      expect(rewardCascadeDeleteMember).not.toHaveBeenCalled();
    });

  it.each([
    undefined, null, '', 20260907, 'not-a-date', '2026-9-07',
    '2026-02-29', '2026-04-31', '2026-13-01', '2026-09-07T00:00:00Z',
  ])('rejects anchorDate %s before writing', async (anchorDate) => {
    const response = await PUT(putRequest({
      members,
      chores: [{ ...chore, anchorDate }],
    }));

    expect(response.status).toBe(400);
    expect(writeChoreData).not.toHaveBeenCalled();
    expect(rewardCascadeDeleteMember).not.toHaveBeenCalled();
  });

  it('rejects the entire update when one of several chores has an invalid interval', async () => {
    const response = await PUT(putRequest({
      members,
      chores: [chore, { ...chore, id: 'invalid-chore', intervalDays: 0 }],
    }));

    expect(response.status).toBe(400);
    expect(writeChoreData).not.toHaveBeenCalled();
  });

  it('does not allow force to bypass recurrence validation', async () => {
    const response = await PUT(putRequest({
      members,
      chores: [{ ...chore, anchorDate: '2026-02-29' }],
      force: true,
    }));

    expect(response.status).toBe(400);
    expect(writeChoreData).not.toHaveBeenCalled();
  });

  it.each([
    [1, '2026-09-07'],
    [3, '2026-09-07'],
    [14, '2024-02-29'],
  ])('preserves intervalDays %s and anchorDate %s', async (intervalDays, anchorDate) => {
    const data = { members, chores: [{ ...chore, intervalDays, anchorDate, daysOfWeek: [2] }] };
    const response = await PUT(putRequest(data));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
    expect(writeChoreData).toHaveBeenCalledExactlyOnceWith(data);
  });

  it.each(['daily', 'weekly', 'biweekly', 'once'] as const)
    ('keeps accepting %s chores without interval metadata', async (frequency) => {
      const legacyChore = { ...chore, frequency, specificDate: '2026-09-07' };
      delete legacyChore.intervalDays;
      delete legacyChore.anchorDate;
      const data = { members, chores: [legacyChore] };
      const response = await PUT(putRequest(data));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(data);
      expect(writeChoreData).toHaveBeenCalledExactlyOnceWith(data);
    });
});
