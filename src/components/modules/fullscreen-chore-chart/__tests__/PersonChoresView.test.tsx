// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/i18n/provider';
import enUSModules from '@/translations/en-US/modules.json';
import type { ChoreDefinition, ChoreMember } from '@/types/config';
import type { MemberStats, ResolvedAssignment } from '@/components/modules/chore-chart/types';
import PersonChoresView from '../PersonChoresView';

type Props = ComponentProps<typeof PersonChoresView>;

const members: ChoreMember[] = [
  { id: 'alex', name: 'Alex', emoji: '', color: '#2563eb' },
  { id: 'sam', name: 'Sam', emoji: '', color: '#16a34a' },
  { id: 'taylor', name: 'Taylor', emoji: '', color: '#db2777' },
];

function chore(id: string, name: string, assigneeIds: string[]): ChoreDefinition {
  return {
    id, name, assigneeIds, emoji: '', points: 3, frequency: 'daily',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'anytime', rotation: 'fixed',
  };
}

const sharedChore = chore('dishwasher', 'Load dishwasher', ['alex', 'sam']);
const assignments: ResolvedAssignment[] = [
  { chore: sharedChore, memberId: 'alex', isCompleted: false },
  { chore: chore('teeth', 'Brush teeth', ['alex']), memberId: 'alex', isCompleted: false },
  { chore: sharedChore, memberId: 'sam', isCompleted: false },
  { chore: chore('reading', 'Read a book', ['sam']), memberId: 'sam', isCompleted: false },
];

function stats(total: number): MemberStats {
  return {
    total, completed: 0, percentage: 0, streak: 0,
    weeklyPoints: 0, weeklyPointsTotal: 0, rewardBalance: 0, weekAssigned: total,
  };
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    members,
    memberStats: new Map([['alex', stats(2)], ['sam', stats(2)], ['taylor', stats(0)]]),
    assignments,
    selectedMemberId: null,
    onSelectMember: vi.fn(),
    allowTouch: true,
    showPoints: true,
    showTimeOfDay: true,
    onToggle: vi.fn().mockResolvedValue(true),
    timezone: 'America/Chicago',
    ...overrides,
  };
}

function wrap(children: ReactNode) {
  return <I18nProvider locale="en-US" blob={{ modules: enUSModules }}>{children}</I18nProvider>;
}

function renderView(value: Props) {
  const view = render(wrap(<PersonChoresView {...value} />));
  return {
    ...view,
    rerenderProps: (next: Props) => view.rerender(wrap(<PersonChoresView {...next} />)),
  };
}

function toggleRow(name: string, member = 'Alex', completed = false): HTMLButtonElement {
  return screen.getByRole('button', {
    name: completed ? `Undo ${name} for ${member}` : `Mark ${name} complete for ${member}`,
  });
}

function deferred() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => cleanup());

describe('PersonChoresView', () => {
  it('requires choosing a person before exposing checkoffs', () => {
    const value = props();
    const view = renderView(value);

    expect(screen.queryByRole('button', { name: /^Mark / })).toBeNull();
    expect(screen.queryByText('Load dishwasher')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show chores for Alex' }));
    expect(value.onSelectMember).toHaveBeenCalledExactlyOnceWith('alex');
    expect(value.onToggle).not.toHaveBeenCalled();

    view.rerenderProps({ ...value, selectedMemberId: 'alex' });
    expect(toggleRow('Load dishwasher')).toBeTruthy();
    expect(toggleRow('Brush teeth')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change person' }));
    expect(value.onSelectMember).toHaveBeenLastCalledWith(null);
    expect(value.onToggle).not.toHaveBeenCalled();
  });

  it('shows only the chosen person’s assignments and scopes shared chores to that member', async () => {
    const value = props({ selectedMemberId: 'sam' });
    renderView(value);

    expect(screen.queryByText('Brush teeth')).toBeNull();
    expect(toggleRow('Read a book', 'Sam')).toBeTruthy();
    expect(screen.getAllByText('Load dishwasher')).toHaveLength(1);
    fireEvent.click(toggleRow('Load dishwasher', 'Sam'));
    await waitFor(() => expect(value.onToggle).toHaveBeenCalledExactlyOnceWith('dishwasher', 'sam'));
  });

  it('lets the entire row toggle once and blocks rapid repeat taps while saving', async () => {
    const pending = deferred();
    const onToggle = vi.fn().mockReturnValue(pending.promise);
    renderView(props({ selectedMemberId: 'alex', onToggle }));
    const button = toggleRow('Load dishwasher');

    // A tap on the title reaches the row action; no small checkbox target is required.
    act(() => {
      fireEvent.click(screen.getByText('Load dishwasher'));
      fireEvent.click(button);
    });
    expect(onToggle).toHaveBeenCalledExactlyOnceWith('dishwasher', 'alex');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    await act(async () => { pending.resolve(true); });
    expect(toggleRow('Load dishwasher').disabled).toBe(false);
  });

  it('shows a failed save, leaves completion unchanged, and permits a retry', async () => {
    const onToggle = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderView(props({ selectedMemberId: 'alex', onToggle }));

    fireEvent.click(toggleRow('Load dishwasher'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/confirm save.*status/i);
    expect(alert.textContent).not.toMatch(/tap to retry/i);
    expect(toggleRow('Load dishwasher').getAttribute('aria-pressed')).toBe('false');
    expect(toggleRow('Load dishwasher').disabled).toBe(false);

    fireEvent.click(toggleRow('Load dishwasher'));
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(2));
    expect(onToggle).toHaveBeenNthCalledWith(2, 'dishwasher', 'alex');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('blocks all checkoffs across person changes until saving finishes, without leaking the old person’s error', async () => {
    const alexSave = deferred();
    const onToggle = vi.fn().mockReturnValueOnce(alexSave.promise).mockResolvedValue(true);
    const value = props({ selectedMemberId: 'alex', onToggle });
    const view = renderView(value);

    fireEvent.click(toggleRow('Load dishwasher'));
    expect(toggleRow('Load dishwasher').disabled).toBe(true);
    expect(toggleRow('Brush teeth').disabled).toBe(true);
    fireEvent.click(toggleRow('Brush teeth'));
    view.rerenderProps({ ...value, selectedMemberId: 'sam' });
    expect(toggleRow('Load dishwasher', 'Sam').disabled).toBe(true);
    fireEvent.click(toggleRow('Load dishwasher', 'Sam'));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith('dishwasher', 'alex');

    await act(async () => { alexSave.resolve(false); });
    expect(toggleRow('Load dishwasher', 'Sam').disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(toggleRow('Load dishwasher', 'Sam'));
    await waitFor(() => expect(toggleRow('Load dishwasher', 'Sam').disabled).toBe(false));
    expect(onToggle.mock.calls).toEqual([['dishwasher', 'alex'], ['dishwasher', 'sam']]);
  });

  it('keeps a completed chore available for undo and uses the same exact assignment ids', async () => {
    const completed = assignments.map((assignment) => assignment.chore.id === 'teeth'
      ? { ...assignment, isCompleted: true } : assignment);
    const value = props({ selectedMemberId: 'alex', assignments: completed });
    const view = renderView(value);
    const button = toggleRow('Brush teeth', 'Alex', true);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    await waitFor(() => expect(value.onToggle).toHaveBeenCalledExactlyOnceWith('teeth', 'alex'));
    view.rerenderProps({ ...value, assignments });
    expect(toggleRow('Brush teeth').getAttribute('aria-pressed')).toBe('false');
  });

  it('disables checkoffs in read-only mode while keeping person selection usable', () => {
    const value = props({ selectedMemberId: 'alex', allowTouch: false });
    renderView(value);

    const button = toggleRow('Load dishwasher');
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(value.onToggle).not.toHaveBeenCalled();
    const switchPerson = screen.getByRole('button', { name: 'Change person' }) as HTMLButtonElement;
    expect(switchPerson.disabled).toBe(false);
    fireEvent.click(switchPerson);
    expect(value.onSelectMember).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('includes people without assignments and gives their empty day an explicit state', () => {
    const value = props();
    const view = renderView(value);
    fireEvent.click(screen.getByRole('button', { name: 'Show chores for Taylor' }));
    expect(value.onSelectMember).toHaveBeenCalledExactlyOnceWith('taylor');
    view.rerenderProps({ ...value, selectedMemberId: 'taylor' });

    expect(screen.getByText('No chores today.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Mark / })).toBeNull();
    expect(value.onToggle).not.toHaveBeenCalled();
  });

  it('surfaces a load failure instead of silently presenting a healthy empty day', () => {
    renderView(props({ selectedMemberId: 'alex', assignments: [], error: true }));
    expect(screen.getByRole('alert').textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.queryByText('No chores today.')).toBeNull();
  });

  it('distinguishes loading from an empty day', () => {
    renderView(props({ selectedMemberId: 'alex', assignments: [], loading: true }));
    expect(screen.getByRole('status').textContent).toMatch(/Loading chores/);
    expect(screen.queryByText('No chores today.')).toBeNull();
  });
});
