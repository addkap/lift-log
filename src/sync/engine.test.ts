import 'fake-indexeddb/auto'; // first: gives Dexie an in-memory IndexedDB
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from '../lib/defaults';
import { markDeleted } from '../lib/draft';
import type { Workout } from '../types';
import { NeedsAuthError } from './graph';
import { getStatus, refreshStatus, runCycle, setRemoteFactory, syncNow } from './engine';
import { parseSyncData, type RemoteStore, type SyncData } from './merge';
import { saveMeta } from './meta';

/** A pretend OneDrive file with real eTag behaviour. `beforeWrite` lets a test act as "the other phone". */
class FakeRemote implements RemoteStore {
  text: string | null = null;
  version = 0;
  writes = 0;
  beforeWrite?: () => void;
  authFails = false;
  async read() {
    if (this.authFails) throw new NeedsAuthError();
    return { etag: this.text ? `"v${this.version}"` : null, data: this.text ? parseSyncData(this.text) : null };
  }
  async write(data: SyncData, etag: string | null) {
    this.beforeWrite?.(); this.beforeWrite = undefined;
    const current = this.text ? `"v${this.version}"` : null;
    if (etag !== current) return 'conflict' as const; // someone changed it since we read
    this.text = JSON.stringify(data); this.version++; this.writes++;
    return 'ok' as const;
  }
  /** Simulate the other phone adding a workout directly to the file. */
  otherPhoneAdds(w: Workout) {
    const d = this.text ? parseSyncData(this.text) : { app: 'lift-log' as const, version: 1 as const, savedAt: 0, exercises: [], templates: [], workouts: [] };
    d.workouts.push(w);
    this.text = JSON.stringify(d); this.version++;
  }
}

const wk = (id: string, updatedAt = Date.now()): Workout => ({
  id, date: '2026-11-08', type: 'lower', entries: [{ exerciseId: 'hack-squat', name: 'Hack squat', sets: [{ weight: 100, reps: 10 }] }],
  createdAt: updatedAt, updatedAt,
});
const live = async () => (await db.workouts.toArray()).filter((w) => !w.deletedAt).map((w) => w.id).sort();

let remote: FakeRemote;
beforeEach(async () => {
  await Promise.all([db.exercises.clear(), db.templates.clear(), db.workouts.clear(), db.meta.clear()]);
  await db.exercises.bulkAdd(DEFAULT_EXERCISES);
  await db.templates.bulkAdd(DEFAULT_TEMPLATES);
  remote = new FakeRemote();
  setRemoteFactory(() => remote);
  await saveMeta({ folder: { driveId: 'D', itemId: 'F', name: 'Family' } });
});

describe('sync engine', () => {
  it('first sync creates the file; the next sync with no changes uploads nothing', async () => {
    await db.workouts.add(wk('a'));
    await syncNow();
    expect(remote.writes).toBe(1);
    expect(parseSyncData(remote.text!).workouts.map((w) => w.id)).toEqual(['a']);
    await syncNow();
    expect(remote.writes).toBe(1);
    await refreshStatus();
    expect(getStatus().dirty).toBe(false);
    expect(getStatus().phase).toBe('idle');
  });

  it('a phone with no data pulls everything from OneDrive', async () => {
    remote.otherPhoneAdds(wk('x'));
    remote.otherPhoneAdds(wk('y'));
    await syncNow();
    expect(await live()).toEqual(['x', 'y']);
  });

  it('local changes show as "not synced" until they upload', async () => {
    await syncNow();
    await db.workouts.add(wk('new'));
    await refreshStatus();
    expect(getStatus().dirty).toBe(true);
    await syncNow();
    expect(getStatus().dirty).toBe(false);
  });

  it('both phones\' workouts survive when the other phone writes in the middle of our sync', async () => {
    await db.workouts.add(wk('mine'));
    remote.otherPhoneAdds(wk('theirs-1'));
    // After we read the file, the other phone saves again, so our upload is refused and we must merge and retry.
    remote.beforeWrite = () => remote.otherPhoneAdds(wk('theirs-2'));
    await runCycle(remote);
    expect(parseSyncData(remote.text!).workouts.map((w) => w.id).sort()).toEqual(['mine', 'theirs-1', 'theirs-2']);
    expect(await live()).toEqual(['mine', 'theirs-1', 'theirs-2']);
  });

  it('deleting a workout syncs as a tombstone and removes it on the other side', async () => {
    const w = wk('gone', 1);
    await db.workouts.add(w);
    await syncNow();
    await db.workouts.put(markDeleted(w, 50));
    await syncNow();
    expect(parseSyncData(remote.text!).workouts[0].deletedAt).toBe(50);

    // The "other phone" still has the live copy; syncing must not bring it back.
    await db.workouts.put(w);
    await syncNow();
    expect(await live()).toEqual([]);
  });

  it('an expired sign-in shows "needs-auth" and loses nothing', async () => {
    await db.workouts.add(wk('keep'));
    remote.authFails = true;
    await syncNow();
    expect(getStatus().phase).toBe('needs-auth');
    expect(await live()).toEqual(['keep']);
    expect(getStatus().dirty).toBe(true); // still queued

    remote.authFails = false;
    await syncNow();
    expect(getStatus().phase).toBe('idle');
    expect(parseSyncData(remote.text!).workouts.map((w) => w.id)).toEqual(['keep']);
  });

  it('gives up after repeated conflicts without losing local data', async () => {
    await db.workouts.add(wk('keep'));
    remote.otherPhoneAdds(wk('t0'));
    const original = remote.write.bind(remote);
    let n = 0;
    remote.write = async (d, e) => { remote.otherPhoneAdds(wk('t' + ++n)); return original(d, e); };
    await syncNow();
    expect(getStatus().phase).toBe('error');
    expect(await live()).toContain('keep');
  });
});
