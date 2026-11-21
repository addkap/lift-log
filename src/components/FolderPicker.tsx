import { useEffect, useState } from 'react';
import { getToken } from '../sync/auth';
import { getStatus, syncNow } from '../sync/engine';
import { listFolders, resolveSharingLink, type FolderChoice } from '../sync/graph';
import { saveMeta } from '../sync/meta';

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/**
 * "Choose the data folder". Two ways to pick:
 *  1. Folders in My files (this is how the folder's owner picks it).
 *  2. Paste a sharing link (this is how the person it was shared with picks it).
 * Only folder names are listed here. The app never lists the files inside the family folder.
 */
export default function FolderPicker({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [trail, setTrail] = useState<FolderChoice[]>([]); // folders we have opened, outermost first
  const [folders, setFolders] = useState<FolderChoice[] | null>(null);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const here = trail[trail.length - 1] ?? null;

  useEffect(() => {
    let current = true;
    setFolders(null);
    setError('');
    listFolders(getToken, here).then((f) => current && setFolders(f)).catch((e) => current && setError(message(e)));
    return () => { current = false; };
  }, [here]);

  /** Remember the folder, then sync right away (this creates lift-log-data.json if it is not there). */
  async function choose(folder: FolderChoice) {
    setBusy(true);
    setError('');
    await saveMeta({ folder, syncedSig: undefined, lastSync: undefined });
    await syncNow();
    setBusy(false);
    const s = getStatus();
    if (s.phase === 'idle') onDone();
    else setError(s.message ?? 'Could not sync with that folder.');
  }

  async function useLink() {
    setBusy(true);
    setError('');
    try {
      const folder = await resolveSharingLink(getToken, link);
      setBusy(false);
      await choose(folder);
    } catch (e) {
      setBusy(false);
      setError(message(e));
    }
  }

  return (
    <>
      <h1>Choose the data folder</h1>
      <p>Pick the family folder where Lift Log keeps one file, <strong>lift-log-data.json</strong>. Nothing else in the folder is touched.</p>

      <section className="card">
        <h2>Folders in My files</h2>
        <p className="muted">{['My files', ...trail.map((t) => t.name)].join(' › ')}</p>
        {here && (
          <>
            <button className="btn primary" disabled={busy} onClick={() => choose(here)}>Use “{here.name}”</button>
            <button className="btn" disabled={busy} onClick={() => setTrail(trail.slice(0, -1))}>Back</button>
          </>
        )}
        {folders === null && !error && <p>Loading folders…</p>}
        {folders?.length === 0 && <p>No folders here.</p>}
        {folders?.map((f) => (
          <div className="folder-row" key={f.driveId + f.itemId}>
            <strong>{f.name}</strong>
            <div className="btns">
              <button className="btn small" disabled={busy} onClick={() => choose(f)}>Use this folder</button>
              <button className="btn small" disabled={busy} onClick={() => setTrail([...trail, f])}>Open</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>A folder shared with me</h2>
        <p>If someone shared the family folder with you, ask them to send you its sharing link, then paste it here.</p>
        <label className="label" htmlFor="sharelink">Sharing link</label>
        <input id="sharelink" className="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://1drv.ms/..." autoCapitalize="none" autoCorrect="off" />
        <button className="btn primary" disabled={busy || !link.trim()} onClick={useLink}>Use this link</button>
      </section>

      {busy && <p className="banner ok" role="status">Connecting to the folder…</p>}
      {error && <p className="banner err" role="alert">{error}</p>}
      <button className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
    </>
  );
}
