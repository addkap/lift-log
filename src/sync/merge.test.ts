import { describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import { emptyData, mergeCollections, mergeData, parseSyncData, sameVersions, signature, type SyncData } from './merge';

const wk = (id: string, updatedAt: number, extra: Partial<Workout> = {}): Workout => ({
  id, date: '2026-11-08', type: 'lower', entries: [], createdAt: 1, updatedAt, ...extra,
});
const data = (workouts: Workout[]): SyncData => ({ ...emptyData(), workouts });

describe('merge by id, latest updatedAt wins', () => {
  it('keeps records from both sides', () => {
    const { merged } = mergeCollections([wk('a', 1)], [wk('b', 1)]);
    expect(merged.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });
  it('the newer edit wins in either direction', () => {
    expect(mergeCollections([wk('a', 5, { date: 'L' })], [wk('a', 9, { date: 'R' })]).merged[0].date).toBe('R');
    expect(mergeCollections([wk('a', 9, { date: 'L' })], [wk('a', 5, { date: 'R' })]).merged[0].date).toBe('L');
  });
  it('reports which remote records must be written locally', () => {
    const r = mergeCollections([wk('a', 9)], [wk('a', 5), wk('b', 1)]);
    expect(r.remoteWon.map((w) => w.id)).toEqual(['b']);
  });
  it('a deletion (tombstone) newer than an edit wins, so the delete syncs', () => {
    const m = mergeCollections([wk('a', 5)], [wk('a', 9, { deletedAt: 9 })]).merged[0];
    expect(m.deletedAt).toBe(9);
  });
  it('an edit newer than a deletion wins (latest wins)', () => {
    const m = mergeCollections([wk('a', 12)], [wk('a', 9, { deletedAt: 9 })]).merged[0];
    expect(m.deletedAt).toBeUndefined();
  });
  it('exact tie: a deletion wins, otherwise local stays', () => {
    expect(mergeCollections([wk('a', 5)], [wk('a', 5, { deletedAt: 5 })]).merged[0].deletedAt).toBe(5);
    expect(mergeCollections([wk('a', 5, { date: 'L' })], [wk('a', 5, { date: 'R' })]).merged[0].date).toBe('L');
  });
  it('merging twice changes nothing (idempotent) and both orders agree', () => {
    const a = data([wk('a', 5), wk('b', 2)]);
    const b = data([wk('a', 3), wk('c', 7)]);
    const ab = mergeData(a, b).merged;
    const ba = mergeData(b, a).merged;
    expect(signature(ab)).toBe(signature(ba));
    expect(signature(mergeData(ab, b).merged)).toBe(signature(ab));
  });
  it('no remote file: nothing to bring in', () => {
    expect(mergeData(data([wk('a', 1)]), null).remoteWon.workouts).toEqual([]);
  });
});

describe('signature', () => {
  it('changes when any record version changes, not when order changes', () => {
    expect(signature(data([wk('a', 1), wk('b', 2)]))).toBe(signature(data([wk('b', 2), wk('a', 1)])));
    expect(signature(data([wk('a', 1)]))).not.toBe(signature(data([wk('a', 2)])));
    expect(signature(data([wk('a', 1)]))).not.toBe(signature(data([wk('a', 1, { deletedAt: 3 })])));
    expect(sameVersions(data([wk('a', 1)]), data([wk('a', 1)]))).toBe(true);
  });
});

describe('parseSyncData', () => {
  it('accepts a valid file and drops junk records', () => {
    const text = JSON.stringify({ app: 'lift-log', version: 1, workouts: [wk('a', 1), { nope: true }] });
    const d = parseSyncData(text);
    expect(d.workouts).toHaveLength(1);
    expect(d.exercises).toEqual([]);
  });
  it('rejects other files with a friendly message', () => {
    expect(() => parseSyncData('not json')).toThrow('not valid JSON');
    expect(() => parseSyncData('{"hello":1}')).toThrow('not a Lift Log');
    expect(() => parseSyncData('{"app":"lift-log","version":9}')).toThrow('newer version');
  });
});
