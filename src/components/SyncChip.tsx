import { signIn } from '../sync/auth';
import { syncNow } from '../sync/engine';
import { syncLabel, useSyncStatus } from '../sync/useSyncStatus';

/** The small status bar under the header. Tap it to sync (or to sign in again if the sign-in expired). */
export default function SyncChip() {
  const s = useSyncStatus();
  if (!s.configured) return null; // OneDrive not set up: nothing to show
  const { text, kind } = syncLabel(s);
  const tap = () => (s.phase === 'needs-auth' ? void signIn('Workout') : void syncNow());
  return (
    <button className={`syncbar ${kind}`} onClick={tap} disabled={s.phase === 'syncing'}>
      {text}
    </button>
  );
}
