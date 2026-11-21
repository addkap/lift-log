import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutType } from '../types';
import { applyDraftToWorkout, markDeleted, setCell, workoutToDraft } from './draft';
import { exerciseSessions, exerciseStats, loggedExercises, summarize } from './stats';

let n = 0;
const w = (date: string, type: WorkoutType = 'lower', sets = [{ weight: 100, reps: 10 }], extra: Partial<Workout> = {}): Workout => ({
  id: 'w' + n++, date, type, createdAt: n, updatedAt: n,
  entries: [{ exerciseId: 'hack-squat', name: 'Hack squat', sets }], ...extra,
});

const TODAY = '2026-11-21'; // a Saturday; its week starts Mon Nov 16

describe('summary', () => {
  const ws = [
    w('2026-11-16'), w('2026-11-21', 'upper'), // this week: 2
    w('2026-11-09', 'full'),                    // last week: 1
    w('2026-10-01'),                            // older than 4 weeks
  ];
  it('counts weeks Monday-Sunday and fills empty weeks with zero', () => {
    const s = summarize(ws, '4w', TODAY);
    expect(s.weeks.map((x) => x.week)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect(s.weeks.map((x) => x.count)).toEqual([0, 0, 1, 2]);
    expect(s.total).toBe(3);
    expect(s.avgPerWeek).toBe(0.75);
    expect(s.weeksWith2Plus).toBe(1);
    expect(s.byType).toEqual({ lower: 1, upper: 1, full: 1 });
  });
  it('Saturday + Sunday count as one week', () => {
    const s = summarize([w('2026-11-21'), w('2026-11-22')], '4w', '2026-11-22');
    expect(s.weeks[s.weeks.length - 1].count).toBe(2);
  });
  it('"all" starts at the first workout', () => {
    const s = summarize(ws, 'all', TODAY);
    expect(s.total).toBe(4);
    expect(s.weeks[0].week).toBe('2026-09-28');
  });
  it('1 week: this week only, with one entry per day Monday to Sunday', () => {
    const s = summarize(ws, '1w', TODAY);
    expect(s.total).toBe(2);
    expect(s.weeks).toHaveLength(1);
    expect(s.days.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 1, 0]);
    expect(s.days[0].date).toBe('2026-11-16');
    expect(s.days[6].date).toBe('2026-11-22');
  });
  it('ignores deleted workouts and handles no data', () => {
    expect(summarize([w('2026-11-16', 'lower', undefined, { deletedAt: 1 })], '4w', TODAY).total).toBe(0);
    expect(summarize([], 'all', TODAY).weeks).toHaveLength(1);
  });
});

describe('per-exercise stats', () => {
  const ws = [
    w('2026-11-01', 'lower', [{ weight: 60, reps: 15 }, { weight: 110, reps: 12 }, { weight: 110, reps: 10 }]),
    w('2026-11-08', 'lower', [{ weight: 120, reps: 12 }, { weight: 120, reps: 12 }]),
  ];
  it('top weight, average reps per set and volume per session', () => {
    const pts = exerciseSessions(ws, 'hack-squat');
    expect(pts.map((p) => p.weight)).toEqual([110, 120]);
    expect(pts[0].volume).toBe(60 * 15 + 110 * 12 + 110 * 10);
    expect(pts[0].avgReps).toBeCloseTo(37 / 3);
    expect(exerciseStats(pts)).toEqual({ best: 120, avgRepsPerSet: 61 / 5, sessions: 2 });
  });
  it('lists logged exercises', () => {
    expect(loggedExercises(ws)).toEqual([{ id: 'hack-squat', name: 'Hack squat' }]);
  });
});

describe('editing history', () => {
  it('fixes a typo and the date, keeping id and createdAt', () => {
    const orig = w('2026-11-08', 'lower', [{ weight: 120, reps: 12 }]);
    let d = workoutToDraft(orig);
    d = setCell(d, d.entries[0].key, 0, 'reps', '11');
    d = { ...d, date: '2026-11-09' };
    const edited = applyDraftToWorkout(orig, d, 999)!;
    expect(edited.id).toBe(orig.id);
    expect(edited.createdAt).toBe(orig.createdAt);
    expect(edited.date).toBe('2026-11-09');
    expect(edited.entries[0].sets).toEqual([{ weight: 120, reps: 11 }]);
    expect(edited.updatedAt).toBe(999);
  });
  it('delete leaves a tombstone, and suggestions then ignore it', () => {
    const gone = markDeleted(w('2026-11-08'), 5);
    expect(gone.deletedAt).toBe(5);
    expect(summarize([gone], '4w', TODAY).total).toBe(0);
  });
});
