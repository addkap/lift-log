// The sync engine. Local-first: logging NEVER waits for this. Sync runs in the background,
// and if anything goes wrong the workouts simply stay on the phone until the next attempt.

import { liveQuery } from 'dexie';
import { db } from '../db';
import type { FolderRef } from '../types';
import { MS_CLIENT_ID } from '../config';
import { getAccount, getToken, type AccountSummary } from './auth';
import { makeGraphRemote, NeedsAuthError } from './graph';
import { applyMerge, readLocalData } from './local';
import { getMeta, saveMeta } from './meta';
import { sameVersions, signature, type RemoteStore, type SyncData } from './merge';

// ---------------------------------------------------------------- status (what the screen shows)

export type SyncPhase = 'idle' | 'syncing' | 'needs-auth' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  configured: boolean; // a folder has been chosen
  folderName?: string;
  lastSync?: number;
  dirty: boolean; // changes on this phone that are not uploaded yet
  account: AccountSummary | null;
  message?: string;
}

let status: SyncStatus = { phase: 'idle', configured: false, dirty: false, account: null };
const listeners = new Set<() => void>();
export const subscribeStatus = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getStatus = () => status;
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

/** Re-check the folder, last sync time, who is signed in, and whether anything is waiting to upload. */
export async function refreshStatus(): Promise<void> {
  const meta = await getMeta();
  const sig = signature(await readLocalData());
  const account = MS_CLIENT_ID ? await getAccount().catch(() => null) : null;
  setStatus({
    configured: !!meta.folder,
    folderName: meta.folder?.name,
    lastSync: meta.lastSync,
    dirty: sig !== meta.syncedSig,
    account,
  });
}

// ---------------------------------------------------------------- one sync

let makeRemote: (folder: FolderRef) => RemoteStore = (folder) => makeGraphRemote(folder, getToken);
/** For tests: swap OneDrive for a fake. */
export function setRemoteFactory(fn: (folder: FolderRef) => RemoteStore) { makeRemote = fn; }

const MAX_ATTEMPTS = 5;

/**
 * read remote -> merge into local -> upload, and if someone else wrote in the meantime
 * (the upload is refused because the eTag changed) start again with their changes included.
 */
export async function runCycle(remote: RemoteStore): Promise<SyncData> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { etag, data } = await remote.read(); // re-read right before every upload
    const merged = await applyMerge(data);
    if (data && sameVersions(merged, data)) return merged; // already identical: nothing to upload
    if ((await remote.write(merged, etag)) === 'ok') return merged;
  }
  throw new Error('The data file kept changing. Try again in a moment.');
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

let inflight: Promise<void> | null = null;

/** Sync now. If a sync is already running, share it instead of starting a second one. */
export function syncNow(): Promise<void> {
  inflight ??= run().finally(() => { inflight = null; });
  return inflight;
}

async function run(): Promise<void> {
  const meta = await getMeta();
  if (!meta.folder) { await refreshStatus(); return; }
  if (isOffline()) { setStatus({ phase: 'offline', message: 'No connection. It will sync later.' }); await refreshStatus(); return; }

  setStatus({ phase: 'syncing', message: undefined });
  try {
    const merged = await runCycle(makeRemote(meta.folder));
    await saveMeta({ syncedSig: signature(merged), lastSync: Date.now() });
    setStatus({ phase: 'idle', message: undefined });
  } catch (e) {
    if (e instanceof NeedsAuthError) setStatus({ phase: 'needs-auth', message: 'Sign in again to sync.' });
    else if (isOffline() || e instanceof TypeError) setStatus({ phase: 'offline', message: 'No connection. It will sync later.' });
    else setStatus({ phase: 'error', message: e instanceof Error ? e.message : 'Sync failed.' });
  }
  await refreshStatus();
}

// ---------------------------------------------------------------- when to sync

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Startup rule: if this phone has no workouts yet but is signed in with a folder chosen,
 * pull everything from OneDrive BEFORE showing the Workout page (so a phone that lost its data
 * gets it back). Gives up after a few seconds so a bad connection never blocks the app.
 */
export async function initialPullIfEmpty(timeoutMs = 6000): Promise<void> {
  if ((await db.workouts.count()) > 0) return;
  if (!MS_CLIENT_ID || !(await getMeta()).folder) return;
  if (!(await getAccount().catch(() => null))) return;
  await Promise.race([syncNow(), sleep(timeoutMs)]);
}

let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

/** Background sync: after changes (a few seconds later), when the app is reopened, and when the signal returns. */
export function startAutoSync(): void {
  if (started) return;
  started = true;

  const auto = () => { if (status.phase !== 'needs-auth') void syncNow(); }; // needs-auth waits for a tap
  const later = () => { clearTimeout(timer); timer = setTimeout(auto, 4000); };

  // Fires at start and every time the saved data changes.
  liveQuery(async () => signature(await readLocalData())).subscribe({
    next: async (sig) => {
      const meta = await getMeta();
      if (meta.folder && sig !== meta.syncedSig) later(); // schedule first: never wait on sign-in setup
      void refreshStatus();
    },
    error: () => { /* never let sync trouble affect logging */ },
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auto(); });
  window.addEventListener('online', auto);
  void refreshStatus().then(auto);
}
