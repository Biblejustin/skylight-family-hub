import { describe, it, expect } from 'vitest';
import { resolveLucideIcon } from '@/lib/lucide-resolver';
import { Puzzle, Clock, Moon, Radar } from 'lucide-react';

describe('resolveLucideIcon', () => {
  it('resolves a known built-in icon', () => {
    expect(resolveLucideIcon('Clock')).toBe(Clock);
  });

  it('resolves a known curated icon', () => {
    expect(resolveLucideIcon('Moon')).toBe(Moon);
    expect(resolveLucideIcon('Radar')).toBe(Radar);
  });

  it('falls back to Puzzle for unknown icon names', () => {
    expect(resolveLucideIcon('NonExistentIcon')).toBe(Puzzle);
  });

  it('falls back to Puzzle for empty string', () => {
    expect(resolveLucideIcon('')).toBe(Puzzle);
  });
});
