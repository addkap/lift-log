// Reading and merging the local database for sync.
import { db } from '../db';
import { mergeData, type SyncData } from './merge';

export async function readLocalData(): Promise<SyncData> {
  const [exercises, templates, workouts] = await Promise.all([db.exercises.toArray(), db.templates.toArray(), db.workouts.toArray()]);
  return { app: 'lift-log', version: 1, savedAt: Date.now(), exercises, templates, workouts };
}

/**
 * Merge the remote data into the local database and return the merged result.
 * Reading, merging and writing happen in ONE transaction, so a workout saved at the same moment
 * can never be overwritten by an older copy.
 */
export function applyMerge(remote: SyncData | null): Promise<SyncData> {
  return db.transaction('rw', db.exercises, db.templates, db.workouts, async () => {
    const { merged, remoteWon } = mergeData(await readLocalData(), remote);
    await db.exercises.bulkPut(remoteWon.exercises);
    await db.templates.bulkPut(remoteWon.templates);
    await db.workouts.bulkPut(remoteWon.workouts);
    return merged;
  });
}
