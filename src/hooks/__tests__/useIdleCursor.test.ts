import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for the idle-cursor logic extracted from useIdleCursor.
 * Since the test environment is node (no DOM), we mock the element API
 * and test the timer/event lifecycle directly.
 */

// Minimal mock element with classList and addEventListener
function makeMockElement() {
  const classes = new Set<string>();
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c),
    },
    addEventListener: (event: string, fn: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    removeEventListener: (event: string, fn: (...args: unknown[]) => void) => {
      const fns = listeners.get(event);
      if (fns) listeners.set(event, fns.filter((f) => f !== fn));
    },
    // helper to simulate events in tests
    _fire: (event: string) => {
      for (const fn of listeners.get(event) ?? []) fn();
    },
    _classes: classes,
  };
}

// Replicate the hook's effect logic so we can test it without React/DOM
function setupIdleCursor(el: ReturnType<typeof makeMockElement>, idleSeconds: number) {
  const idleMs = idleSeconds * 1000;
  let timer: ReturnType<typeof setTimeout>;

  const hide = () => el.classList.add('cursor-idle');
  const show = () => {
    el.classList.remove('cursor-idle');
    clearTimeout(timer);
    timer = setTimeout(hide, idleMs);
  };

  hide();
  el.addEventListener('mousemove', show);

  return {
    cleanup: () => {
      clearTimeout(timer);
      el.removeEventListener('mousemove', show);
      el.classList.remove('cursor-idle');
    },
  };
}

describe('useIdleCursor logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides cursor immediately on setup', () => {
    const el = makeMockElement();
    setupIdleCursor(el, 3);
    expect(el.classList.contains('cursor-idle')).toBe(true);
  });

  it('shows cursor on mousemove, then hides after timeout', () => {
    const el = makeMockElement();
    setupIdleCursor(el, 3);

    el._fire('mousemove');
    expect(el.classList.contains('cursor-idle')).toBe(false);

    vi.advanceTimersByTime(2999);
    expect(el.classList.contains('cursor-idle')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(el.classList.contains('cursor-idle')).toBe(true);
  });

  it('resets timer on repeated mousemove', () => {
    const el = makeMockElement();
    setupIdleCursor(el, 3);

    el._fire('mousemove');
    vi.advanceTimersByTime(2000);
    // Move again — should reset the 3s timer
    el._fire('mousemove');
    expect(el.classList.contains('cursor-idle')).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(el.classList.contains('cursor-idle')).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(el.classList.contains('cursor-idle')).toBe(true);
  });

  it('respects custom idle duration', () => {
    const el = makeMockElement();
    setupIdleCursor(el, 10);

    el._fire('mousemove');
    vi.advanceTimersByTime(9999);
    expect(el.classList.contains('cursor-idle')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(el.classList.contains('cursor-idle')).toBe(true);
  });

  it('cleanup removes class, timer, and listener', () => {
    const el = makeMockElement();
    const { cleanup } = setupIdleCursor(el, 3);

    el._fire('mousemove');
    cleanup();

    expect(el.classList.contains('cursor-idle')).toBe(false);

    // Timer should be cleared — advancing time should not re-add the class
    vi.advanceTimersByTime(5000);
    expect(el.classList.contains('cursor-idle')).toBe(false);

    // Listener should be removed — mousemove should have no effect
    el._fire('mousemove');
    vi.advanceTimersByTime(5000);
    expect(el.classList.contains('cursor-idle')).toBe(false);
  });
});
