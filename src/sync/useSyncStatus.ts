import { useSyncExternalStore } from 'react';
import { getStatus, subscribeStatus, type SyncStatus } from './engine';

/** The current sync status, for showing "Synced" / "Not synced yet" / "Tap to sync". */
export const useSyncStatus = () => useSyncExternalStore(subscribeStatus, getStatus);

export type LabelKind = 'ok' | 'warn' | 'bad' | 'busy';

/** The short sentence for the status bar, e.g. "Synced" or "Tap to sync". */
export function syncLabel(s: SyncStatus): { text: string; kind: LabelKind } {
  if (s.phase === 'syncing') return { text: 'Syncing…', kind: 'busy' };
  if (s.phase === 'needs-auth') return { text: 'Tap to sync', kind: 'bad' };
  if (s.phase === 'offline') return { text: 'Offline: will sync later', kind: 'warn' };
  if (s.phase === 'error') return { text: 'Not synced yet. Tap to try again', kind: 'bad' };
  if (s.dirty || !s.lastSync) return { text: 'Not synced yet. Tap to sync', kind: 'warn' };
  return { text: 'Synced', kind: 'ok' };
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
