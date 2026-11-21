import { describe, expect, it } from 'vitest';
import type { SetRecord, Workout } from '../types';
import { describeSets, findLastSession, hintFor, suggestNext, topWeightSets } from './progression';

// Helper: build sets at one weight from a list of reps.
const sets = (weight: number, ...reps: number[]): SetRecord[] => reps.map((r) => ({ weight, reps: r }));

describe('progression rule (the examples from the spec)', () => {
  it('12,12,11 -> increase (avg 11.67)', () => {
    const s = suggestNext(sets(120, 12, 12, 11), 5)!;
    expect(s.weight).toBe(125);
    expect(s.increased).toBe(true);
    expect(s.text).toBe('Suggested: 125 lb (up 5, you hit 12+ reps)');
  });
  it('12,11 -> increase (avg exactly 11.5)', () => {
    expect(suggestNext(sets(120, 12, 11), 5)!.weight).toBe(125);
  });
  it('12,10,10 -> same weight', () => {
    const s = suggestNext(sets(120, 12, 10, 10), 5)!;
    expect(s.weight).toBe(120);
    expect(s.increased).toBe(false);
    expect(s.text).toBe('Suggested: 120 lb (same)');
  });
  it('14,9,9 -> same weight', () => {
    expect(suggestNext(sets(120, 14, 9, 9), 5)!.weight).toBe(120);
  });
});

describe('progression edge cases', () => {
  it('only the heaviest weight counts (warm-up sets are ignored)', () => {
    // Warm-up of 15 reps at 60 lb must not pull the average down or count as the max.
    const s = [...sets(60, 15), ...sets(120, 12, 12)];
    expect(topWeightSets(s)).toHaveLength(2);
    expect(suggestNext(s, 5)!.weight).toBe(125);
  });
  it('a single heavy set under 12 reps stays the same', () => {
    expect(suggestNext([...sets(60, 15), ...sets(120, 8)], 5)!.weight).toBe(120);
  });
  it('rows with no reps are ignored', () => {
    expect(suggestNext([...sets(120, 12, 12), { weight: 130, reps: 0 }], 5)!.weight).toBe(125);
  });
  it('supports decimal weights and increments', () => {
    const s = suggestNext(sets(122.5, 12, 12), 2.5)!;
    expect(s.weight).toBe(125);
    expect(s.text).toBe('Suggested: 125 lb (up 2.5, you hit 12+ reps)');
  });
  it('never decreases and returns null with no usable sets', () => {
    expect(suggestNext([], 5)).toBeNull();
    expect(suggestNext(sets(100, 0, 0), 5)).toBeNull();
    expect(suggestNext(sets(100, 3), 5)!.weight).toBe(100);
  });
});

const workout = (id: string, date: string, exerciseId: string, s: SetRecord[], extra: Partial<Workout> = {}): Workout => ({
  id,
  date,
  type: 'lower',
  entries: [{ exerciseId, name: exerciseId, sets: s }],
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

describe('findLastSession / hints', () => {
  const history = [
    workout('a', '2026-11-01', 'hack-squat', sets(110, 12, 12, 12)),
    workout('b', '2026-11-08', 'hack-squat', sets(120, 12, 12, 11)),
  ];
  it('uses the most recent date', () => {
    expect(findLastSession(history, 'hack-squat')!.date).toBe('2026-11-08');
  });
  it('skips deleted workouts, so deleting a workout changes the suggestion', () => {
    const h = [history[0], { ...history[1], deletedAt: 5 }];
    expect(findLastSession(h, 'hack-squat')!.date).toBe('2026-11-01');
  });
  it('can look only at workouts before a date', () => {
    expect(findLastSession(history, 'hack-squat', { beforeDate: '2026-11-08' })!.date).toBe('2026-11-01');
  });
  it('shared exercise: history from any workout type counts', () => {
    const full = workout('c', '2026-11-15', 'hack-squat', sets(125, 10), { type: 'full' });
    expect(findLastSession([...history, full], 'hack-squat')!.sets[0].weight).toBe(125);
  });
  it('builds the card text', () => {
    const h = hintFor(history, { id: 'hack-squat', increment: 5 });
    expect(h.lastText).toBe('Last time (Nov 8): 120 lb x 12, 12, 11');
    expect(h.suggestionText).toBe('Suggested: 125 lb (up 5, you hit 12+ reps)');
    expect(h.weight).toBe('125');
  });
  it('no history: blank weight, or the custom starting weight', () => {
    expect(hintFor([], { id: 'x', increment: 5 }).weight).toBe('');
    expect(hintFor([], { id: 'x', increment: 5 }, '40').weight).toBe('40');
  });
  it('describes sets at mixed weights', () => {
    expect(describeSets([...sets(60, 15), ...sets(120, 12, 11)])).toBe('60 lb x 15; 120 lb x 12, 11');
  });
});
