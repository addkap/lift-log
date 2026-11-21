// Pure merge logic for syncing. No network and no database in this file, so it is easy to test.
//
// Rules: every record has an id and updatedAt. When both sides have the same record, the one with the
// newer updatedAt wins. A deleted record is kept as a "tombstone" (deletedAt set) so the deletion
// travels to the other device instead of the record coming back.

import type { Exercise, Template, Workout } from '../types';

export interface SyncData {
  app: 'lift-log';
  version: 1;
  savedAt: number;
  exercises: Exercise[];
  templates: Template[];
  workouts: Workout[];
}

/** The remote copy (the JSON file in OneDrive). etag is null when the file does not exist yet. */
export interface RemoteStore {
  read(): Promise<{ etag: string | null; data: SyncData | null }>;
  /** Save only if the file is still the version we read ('conflict' means someone else wrote first). */
  write(data: SyncData, etag: string | null): Promise<'ok' | 'conflict'>;
}

export const emptyData = (): SyncData => ({ app: 'lift-log', version: 1, savedAt: 0, exercises: [], templates: [], workouts: [] });

interface Rec { id: string; updatedAt: number; deletedAt?: number }

/** Should the remote record replace the local one? Newest wins; on an exact tie a deletion wins. */
function remoteIsNewer(local: Rec, remote: Rec): boolean {
  if (remote.updatedAt !== local.updatedAt) return remote.updatedAt > local.updatedAt;
  return !!remote.deletedAt && !local.deletedAt;
}

export function mergeCollections<T extends Rec>(local: T[], remote: T[]): { merged: T[]; remoteWon: T[] } {
  const byId = new Map(local.map((r) => [r.id, r]));
  const remoteWon: T[] = [];
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || remoteIsNewer(l, r)) {
      byId.set(r.id, r);
      remoteWon.push(r);
    }
  }
  return { merged: [...byId.values()], remoteWon };
}

export interface MergeResult {
  merged: SyncData;
  /** The records that came from the remote and must be written to the local database. */
  remoteWon: Pick<SyncData, 'exercises' | 'templates' | 'workouts'>;
}

export function mergeData(local: SyncData, remote: SyncData | null): MergeResult {
  if (!remote) {
    return { merged: local, remoteWon: { exercises: [], templates: [], workouts: [] } };
  }
  const e = mergeCollections(local.exercises, remote.exercises);
  const t = mergeCollections(local.templates, remote.templates);
  const w = mergeCollections(local.workouts, remote.workouts);
  return {
    merged: { ...local, savedAt: Date.now(), exercises: e.merged, templates: t.merged, workouts: w.merged },
    remoteWon: { exercises: e.remoteWon, templates: t.remoteWon, workouts: w.remoteWon },
  };
}

/**
 * A short fingerprint of "which version of every record we have". If the fingerprint of the phone's data
 * differs from the fingerprint at the last sync, there are changes waiting to upload.
 */
export function signature(d: Pick<SyncData, 'exercises' | 'templates' | 'workouts'>): string {
  const lines: string[] = [];
  for (const [kind, list] of [['e', d.exercises], ['t', d.templates], ['w', d.workouts]] as const) {
    for (const r of list as Rec[]) lines.push(`${kind}:${r.id}:${r.updatedAt}:${r.deletedAt ?? 0}`);
  }
  lines.sort();
  let h = 5381; // djb2 hash
  for (const ch of lines.join('\n')) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `${lines.length}-${h.toString(16)}`;
}

/** True if both sides hold exactly the same record versions (so nothing needs uploading). */
export function sameVersions(a: SyncData, b: SyncData): boolean {
  return signature(a) === signature(b);
}

/** Read and check a Lift Log JSON file (from OneDrive or from a backup). Throws a friendly Error if it is wrong. */
export function parseSyncData(text: string): SyncData {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || raw.app !== 'lift-log') throw new Error('That is not a Lift Log data file.');
  if (typeof raw.version === 'number' && raw.version > 1) throw new Error('That file is from a newer version of Lift Log. Update the app first.');
  const records = <T,>(v: unknown): T[] =>
    Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.updatedAt === 'number') : [];
  return {
    app: 'lift-log',
    version: 1,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
    exercises: records<Exercise>(raw.exercises),
    templates: records<Template>(raw.templates),
    workouts: records<Workout>(raw.workouts),
  };
}
