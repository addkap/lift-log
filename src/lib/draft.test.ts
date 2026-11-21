import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from './defaults';
import {
  addRow, buildDraft, draftToWorkout, moveEntry, removeEntry, removeLastRow, sanitizeNumber, setCell,
} from './draft';
import type { Workout } from '../types';

const lower = DEFAULT_TEMPLATES.find((t) => t.id === 'lower')!;
const fresh = () => buildDraft('lower', '2026-11-21', lower, DEFAULT_EXERCISES, []);

describe('draft editing', () => {
  it('starts in template order with the minimum number of sets', () => {
    const d = fresh();
    expect(d.entries.map((e) => e.exerciseId)).toEqual(lower.items.map((i) => i.exerciseId));
    expect(d.entries[0].rows).toHaveLength(3); // hack squat 3-4
    expect(d.entries[2].rows).toHaveLength(2); // quad extension 2-3
  });
  it('add set / remove last set, never below one row', () => {
    let d = fresh();
    const key = d.entries[0].key;
    d = addRow(d, key);
    expect(d.entries[0].rows).toHaveLength(4);
    for (let i = 0; i < 10; i++) d = removeLastRow(d, key);
    expect(d.entries[0].rows).toHaveLength(1);
  });
  it('a new set copies the previous weight', () => {
    let d = fresh();
    const key = d.entries[0].key;
    d = setCell(d, key, 2, 'weight', '130');
    expect(addRow(d, key).entries[0].rows[3].weight).toBe('130');
  });
  it('moves exercises up and down, and stops at the ends', () => {
    let d = fresh();
    const [a, b] = [d.entries[0].key, d.entries[1].key];
    d = moveEntry(d, a, 1);
    expect(d.entries[0].key).toBe(b);
    expect(d.entries[1].key).toBe(a);
    expect(moveEntry(d, b, -1)).toBe(d); // already first
  });
  it('removing an exercise only changes the draft, not the template', () => {
    const before = JSON.stringify(lower);
    const d = fresh();
    expect(removeEntry(d, d.entries[0].key).entries).toHaveLength(4);
    expect(JSON.stringify(lower)).toBe(before);
  });
  it('prefills weights from history', () => {
    const history: Workout[] = [{
      id: 'w', date: '2026-11-08', type: 'lower', createdAt: 1, updatedAt: 1,
      entries: [{ exerciseId: 'hack-squat', name: 'Hack squat', sets: [12, 12, 11].map((reps) => ({ weight: 120, reps })) }],
    }];
    const d = buildDraft('lower', '2026-11-21', lower, DEFAULT_EXERCISES, history);
    expect(d.entries[0].rows.every((r) => r.weight === '125')).toBe(true);
    expect(d.entries[1].rows[0].weight).toBe(''); // no history for back extension
  });
});

describe('saving', () => {
  it('ignores rows with no reps and exercises with no sets', () => {
    let d = fresh();
    d = setCell(d, d.entries[0].key, 0, 'weight', '120');
    d = setCell(d, d.entries[0].key, 0, 'reps', '12');
    d = setCell(d, d.entries[0].key, 1, 'weight', '120'); // no reps -> ignored
    const w = draftToWorkout(d)!;
    expect(w.entries).toHaveLength(1);
    expect(w.entries[0].sets).toEqual([{ weight: 120, reps: 12 }]);
    expect(w.date).toBe('2026-11-21');
  });
  it('returns null when nothing was logged', () => {
    expect(draftToWorkout(fresh())).toBeNull();
  });
});

describe('number boxes', () => {
  it('weight allows one decimal point; reps are digits only', () => {
    expect(sanitizeNumber('122.5', true)).toBe('122.5');
    expect(sanitizeNumber('12,5', true)).toBe('12.5');
    expect(sanitizeNumber('1.2.3', true)).toBe('1.23');
    expect(sanitizeNumber('1a2.5', false)).toBe('125');
  });
});
