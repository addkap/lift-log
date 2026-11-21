import { useEffect, useState } from 'react';
import { getAccount, isConfigured, signIn, signOut, takeRedirectError } from '../sync/auth';
import { refreshStatus, syncNow } from '../sync/engine';
import { formatDateTime, syncLabel, useSyncStatus } from '../sync/useSyncStatus';
import FolderPicker from './FolderPicker';

/** Settings card: who is signed in, which folder, last sync, and the Sync now button. */
export default function OneDriveSettings() {
  const s = useSyncStatus();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void refreshStatus();
    if (isConfigured()) {
      void getAccount().catch(() => null).then(() => {
        const problem = takeRedirectError();
        if (problem) setError(`Sign-in did not finish: ${problem}`);
      });
    }
  }, []);

  if (!isConfigured()) {
    return (
      <section className="card">
        <h2>OneDrive sync</h2>
        <p>OneDrive sync is not set up in this copy of the app yet. (The app needs a Microsoft client ID. See README.md.)</p>
      </section>
    );
  }
  if (picking) return <FolderPicker onDone={() => setPicking(false)} onCancel={() => setPicking(false)} />;

  const label = syncLabel(s);
  const run = (fn: () => Promise<void>) => fn().catch((e) => setError(e instanceof Error ? e.message : 'Something went wrong.'));

  return (
    <section className="card">
      <h2>OneDrive sync</h2>
      {s.account ? <p>Signed in as <strong>{s.account.name}</strong><br /><span className="muted">{s.account.username}</span></p> : <p>Not signed in.</p>}
      <p>Folder: <strong>{s.folderName ?? 'none chosen yet'}</strong></p>
      {s.configured && (
        <>
          <p>Status: <strong>{label.text}</strong></p>
          <p className="muted">Last sync: {s.lastSync ? formatDateTime(s.lastSync) : 'never'}</p>
          {s.message && <p className="banner err" role="status">{s.message}</p>}
        </>
      )}
      {error && <p className="banner err" role="alert">{error}</p>}

      {!s.account && <button className="btn primary" onClick={() => run(() => signIn('Settings'))}>Sign in with Microsoft</button>}
      {s.account && <button className="btn" onClick={() => setPicking(true)}>{s.configured ? 'Change the data folder' : 'Choose the data folder'}</button>}
      {s.configured && (
        <button className="btn primary" disabled={s.phase === 'syncing'} onClick={() => run(() => (s.phase === 'needs-auth' ? signIn('Settings') : syncNow()))}>
          {s.phase === 'syncing' ? 'Syncing…' : s.phase === 'needs-auth' ? 'Sign in to sync' : 'Sync now'}
        </button>
      )}
      {s.account && (
        <button className="btn danger" onClick={() => window.confirm('Sign out of Microsoft on this phone? Your workouts stay here.') && run(async () => { await signOut(); await refreshStatus(); })}>
          Sign out
        </button>
      )}
    </section>
  );
}
