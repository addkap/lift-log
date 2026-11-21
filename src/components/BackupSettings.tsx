import { useState } from 'react';
import { todayLocal } from '../lib/dates';
import { applyMerge, readLocalData } from '../sync/local';
import { parseSyncData } from '../sync/merge';

/** Export / Import a JSON backup. The file has the same format as the one in OneDrive. */
export default function BackupSettings() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function exportBackup() {
    const data = await readLocalData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lift-log-backup-${todayLocal()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    setError('');
    setMessage(`Backup saved with ${data.workouts.filter((w) => !w.deletedAt).length} workouts.`);
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      const incoming = parseSyncData(await file.text());
      await applyMerge(incoming); // merges: newer data on this phone is kept, nothing is wiped
      setError('');
      setMessage(`Restored. The backup had ${incoming.workouts.filter((w) => !w.deletedAt).length} workouts.`);
    } catch (e) {
      setMessage('');
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  }

  return (
    <section className="card">
      <h2>Backup</h2>
      <p className="muted">Save all workouts to a file, or restore from one. Restoring adds to what is on this phone, it never wipes it.</p>
      <button className="btn" onClick={exportBackup}>Export backup</button>
      <label className="btn filebtn">
        Import backup
        <input type="file" accept="application/json,.json" onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {message && <p className="banner ok" role="status">{message}</p>}
      {error && <p className="banner err" role="alert">{error}</p>}
    </section>
  );
}
