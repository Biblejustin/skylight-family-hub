// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChoreCompletion } from '@/types/config';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  completions: { completions: [] as ChoreCompletion[] },
  data: {
    members: [
      { id: 'a', name: 'Alex', emoji: 'A', color: '#60a5fa' },
      { id: 'b', name: 'Blair', emoji: 'B', color: '#f472b6' },
    ],
    chores: [{ id: 'shared', name: 'Make bed', emoji: '', points: 4, frequency: 'daily', daysOfWeek: [], timeOfDay: 'morning', assigneeIds: ['a', 'b'], rotation: 'fixed' }],
  },
  rewards: { balances: { a: 2, b: 7 }, redemptions: [], rewards: [] },
}));
vi.mock('@/hooks/useFetchData', () => ({
  useFetchData: (url: string) => [url === '/api/chores/data' ? mocks.data : url === '/api/rewards' ? mocks.rewards : mocks.completions, null, 1],
}));
vi.mock('@/lib/display-fetch', () => ({ displayFetch: mocks.fetch }));
vi.mock('@/i18n', () => ({ useFormattingLocale: () => 'en-US' }));

import { useChoreData } from '../useChoreData';
import { todayStr } from '../types';

const config = { weekStartDay: 'sunday' as const, showPoints: true, showStreaks: true, showTimeOfDay: true, accentColor: '' };
beforeEach(() => { mocks.fetch.mockReset(); mocks.completions = { completions: [] }; });
afterEach(() => cleanup());

describe('person chore mutation result', () => {
  it('sends explicit intent for one member and applies server completion/balance', async () => {
    const completion = { choreId: 'shared', memberId: 'a', date: todayStr() };
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ completions: [completion], rewards: { ...mocks.rewards, balances: { a: 6, b: 7 } } }) });
    const { result, rerender } = renderHook(() => useChoreData(config));
    let saved = false;
    await act(async () => { saved = await result.current.toggleCompleteResult('shared', 'a', 'complete'); });
    expect(saved).toBe(true);
    const request = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(request).toEqual({ ...completion, direction: 'complete' });
    expect(result.current.todayAssignments.find(item => item.memberId === 'a')?.isCompleted).toBe(true);
    expect(result.current.todayAssignments.find(item => item.memberId === 'b')?.isCompleted).toBe(false);
    expect(result.current.memberStats.get('a')?.rewardBalance).toBe(6);
    expect(result.current.memberStats.get('b')?.rewardBalance).toBe(7);
    // A poll started before the write can arrive after its response.
    mocks.completions = { completions: [] };
    rerender();
    expect(result.current.todayAssignments.find(item => item.memberId === 'a')?.isCompleted).toBe(true);
  });

  it('returns failure, rolls back only active optimistic request, and permits safe retry', async () => {
    const sibling = { choreId: 'shared', memberId: 'b', date: todayStr() };
    mocks.completions = { completions: [sibling] };
    mocks.fetch.mockRejectedValue(new Error('response lost'));
    const { result } = renderHook(() => useChoreData(config));
    await waitFor(() => expect(result.current.todayAssignments.find(item => item.memberId === 'b')?.isCompleted).toBe(true));
    let saved = true;
    await act(async () => { saved = await result.current.toggleCompleteResult('shared', 'a', 'complete'); });
    expect(saved).toBe(false);
    expect(result.current.todayAssignments.find(item => item.memberId === 'a')?.isCompleted).toBe(false);
    expect(result.current.todayAssignments.find(item => item.memberId === 'b')?.isCompleted).toBe(true);
    await act(async () => { await result.current.toggleCompleteResult('shared', 'a', 'complete'); });
    expect(mocks.fetch.mock.calls.map(([, init]) => JSON.parse(init.body).direction)).toEqual(['complete', 'complete']);
  });

  it('sends explicit undo and reports HTTP failure without pretending it saved', async () => {
    mocks.completions = { completions: [{ choreId: 'shared', memberId: 'a', date: todayStr() }] };
    mocks.fetch.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useChoreData(config));
    await waitFor(() => expect(result.current.todayAssignments.find(item => item.memberId === 'a')?.isCompleted).toBe(true));
    let saved = true;
    await act(async () => { saved = await result.current.toggleCompleteResult('shared', 'a', 'uncomplete'); });
    expect(saved).toBe(false);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).direction).toBe('uncomplete');
    expect(result.current.todayAssignments.find(item => item.memberId === 'a')?.isCompleted).toBe(true);
  });
});
