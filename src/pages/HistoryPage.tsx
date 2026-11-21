import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import NumberField from '../components/NumberField';
import { addRow, applyDraftToWorkout, markDeleted, removeLastRow, setCell, workoutToDraft } from '../lib/draft';
import { formatLongDate } from '../lib/dates';
import { describeSets } from '../lib/progression';
import { liveWorkouts } from '../lib/stats';
import { WORKOUT_LABELS, type Draft, type Workout } from '../types';

/** List of past workouts, newest first. Tap one to fix it, change its date, or delete it. */
export default function HistoryPage() {
  const all = useLiveQuery(() => db.workouts.toArray(), [], []);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = liveWorkouts(all).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const open = list.find((w) => w.id === openId);
  if (open) return <EditWorkout key={open.id} workout={open} onClose={() => setOpenId(null)} />;

  return (
    <>
      <h1>History</h1>
      {list.length === 0 && <p>No workouts saved yet. Log one on the Workout tab.</p>}
      {list.map((w) => (
        <button key={w.id} className="list-item" onClick={() => setOpenId(w.id)}>
          <strong>{formatLongDate(w.date)} · {WORKOUT_LABELS[w.type]}</strong>
          <span>{w.entries.length} {w.entries.length === 1 ? 'exercise' : 'exercises'}, {w.entries.reduce((n, e) => n + e.sets.length, 0)} sets</span>
        </button>
      ))}
    </>
  );
}

function EditWorkout({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => workoutToDraft(workout));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  const change = (fn: (d: Draft) => Draft) => { setDraft(fn); setDirty(true); setError(''); };

  async function save() {
    const updated = applyDraftToWorkout(workout, draft);
    if (!updated) { setError('No reps are left in this workout. To remove it completely, tap Delete workout.'); return; }
    await db.workouts.put(updated);
    onClose();
  }

  async function remove() {
    if (window.confirm('Delete this workout? This cannot be undone.')) {
      await db.workouts.put(markDeleted(workout));
      onClose();
    }
  }

  return (
    <>
      <h1>{WORKOUT_LABELS[workout.type]}</h1>
      <label className="label" htmlFor="hdate">Date: {formatLongDate(draft.date)}</label>
      <input id="hdate" className="date" type="date" value={draft.date} onChange={(e) => e.target.value && change((d) => ({ ...d, date: e.target.value }))} />

      {draft.entries.map((entry) => (
        <section className="card" key={entry.key}>
          <h2>{entry.name}</h2>
          <div className="rows">
            <div className="row head"><span /><span>Weight (lb)</span><span>Reps</span></div>
            {entry.rows.map((r, i) => (
              <div className="row" key={i}>
                <span className="setno">Set {i + 1}</span>
                <NumberField decimal label={`${entry.name} set ${i + 1} weight in pounds`} value={r.weight} onChange={(v) => change((d) => setCell(d, entry.key, i, 'weight', v))} />
                <NumberField label={`${entry.name} set ${i + 1} reps`} value={r.reps} onChange={(v) => change((d) => setCell(d, entry.key, i, 'reps', v))} />
              </div>
            ))}
          </div>
          <div className="btns">
            <button className="btn" onClick={() => change((d) => addRow(d, entry.key))}>Add set</button>
            <button className="btn" disabled={entry.rows.length <= 1} onClick={() => change((d) => removeLastRow(d, entry.key))}>Remove last set</button>
          </div>
        </section>
      ))}
      <p className="muted">Sets with no reps are removed when you save.</p>

      {error && <p className="banner err" role="alert">{error}</p>}
      <button className="btn primary big" onClick={save}>Save changes</button>
      <button className="btn" onClick={() => (!dirty || window.confirm('Leave without saving your changes?')) && onClose()}>Back</button>
      <button className="btn danger" onClick={remove}>Delete workout</button>
      <p className="muted">Original: {workout.entries.map((e) => `${e.name} ${describeSets(e.sets)}`).join(' · ')}</p>
    </>
  );
}
