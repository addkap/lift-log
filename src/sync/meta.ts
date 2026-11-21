// Sync settings for this device (which folder, when we last synced).
import { db } from '../db';
import type { SyncMeta } from '../types';

const LS_KEY = 'lift-sync-folder';

export async function getMeta(): Promise<SyncMeta> {
  const m = await db.meta.get('sync');
  if (m) return m;
  // A second copy of the folder choice lives in localStorage, so if the browser wipes only the database,
  // a signed-in phone can still find its folder and pull everything back.
  try {
    if (typeof window === 'undefined') throw new Error('no browser');
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (saved?.folder) return { id: 'sync', folder: saved.folder };
  } catch {
    /* no localStorage (tests) or bad data: ignore */
  }
  return { id: 'sync' };
}

export async function saveMeta(patch: Partial<SyncMeta>): Promise<SyncMeta> {
  const next: SyncMeta = { ...(await getMeta()), ...patch, id: 'sync' };
  await db.meta.put(next);
  try {
    if (typeof window === 'undefined') throw new Error('no browser');
    localStorage.setItem(LS_KEY, JSON.stringify({ folder: next.folder }));
  } catch {
    /* ignore */
  }
  return next;
}
