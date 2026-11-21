import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addCustomExercise, discardDraft, finishWorkout, loadDraft, saveDraft, startWorkout } from '../store';
import { addEntry, addRow, entryHasData, moveEntry, removeEntry, removeLastRow, sanitizeNumber, setCell } from '../lib/draft';
import { formatLongDate, todayLocal } from '../lib/dates';
import { hintFor } from '../lib/progression';
import { WORKOUT_LABELS, type Draft, type Workout, type WorkoutType } from '../types';
import ExerciseCard from '../components/ExerciseCard';
import { isConfigured } from '../sync/auth';
import { useSyncStatus } from '../sync/useSyncStatus';

export default function WorkoutPage({ onGoSettings }: { onGoSettings: () => void }) {
  // undefined = still loading, null = no workout in progress
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const draftRef = useRef<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  const workouts = useLiveQuery(() => db.workouts.toArray(), [], []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);

  // On open, pick up any workout that was in progress (autosave).
  useEffect(() => {
    loadDraft().then((d) => {
      draftRef.current = d ?? null;
      setDraft(d ?? null);
    });
  }, []);

  /** Change the draft and autosave it immediately. */
  function update(fn: (d: Draft) => Draft) {
    const cur = draftRef.current;
    if (!cur) return;
    const next = { ...fn(cur), updatedAt: Date.now() };
    draftRef.current = next;
    setDraft(next);
    void saveDraft(next);
  }

  function replace(next: Draft | null) {
    draftRef.current = next;
    setDraft(next);
  }

  if (draft === undefined) return <p>Loading…</p>;

  if (draft === null) {
    return <StartScreen saved={saved} onGoSettings={onGoSettings} onStart={async (type, date) => { setSaved(false); replace(await startWorkout(type, date)); }} />;
  }

  return (
    <ActiveWorkout
      draft={draft}
      incrementOf={(id) => exercises.find((e) => e.id === id)?.increment ?? 5}
      workouts={workouts}
      update={update}
      onFinished={() => { replace(null); setSaved(true); }}
      onCancel={async () => { await discardDraft(); replace(null); }}
      onCustom={async (opts) => {
        // addCustomExercise saves the exercise itself; the new card is then added through update(),
        // which autosaves the draft and keeps anything typed in the meantime.
        const withNew = await addCustomExercise(draftRef.current!, opts);
        const added = withNew.entries[withNew.entries.length - 1];
        update((d) => addEntry(d, added));
      }}
    />
  );
}

// ---------------------------------------------------------------- start screen

function StartScreen({ saved, onStart, onGoSettings }: { saved: boolean; onStart: (t: WorkoutType, date: string) => void; onGoSettings: () => void }) {
  const sync = useSyncStatus();
  const [type, setType] = useState<WorkoutType | null>(null);
  const [date, setDate] = useState(todayLocal());

  return (
    <>
      <h1>Start a workout</h1>
      {isConfigured() && !sync.configured && (
        <section className="card">
          <h2>Back up to OneDrive</h2>
          <p>Your workouts are safe on this phone. Set up OneDrive to keep a copy too.</p>
          <button className="btn" onClick={onGoSettings}>Set up OneDrive</button>
        </section>
      )}
      {saved && <p className="banner ok" role="status">Workout saved. Great job, Go Bills!</p>}

      <p className="label">Which workout?</p>
      <div className="choices">
        {(['lower', 'upper', 'full'] as WorkoutType[]).map((t) => (
          <button key={t} className={type === t ? 'choice selected' : 'choice'} aria-pressed={type === t} onClick={() => setType(t)}>
            {WORKOUT_LABELS[t]}
          </button>
        ))}
      </div>

      <label className="label" htmlFor="date">Date</label>
      <input id="date" className="date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />

      <button className="btn primary big" disabled={!type} onClick={() => type && onStart(type, date)}>
        Start
      </button>
      {!type && <p className="muted">Tap Lower Body, Upper Body or Full Body first.</p>}
    </>
  );
}

// ---------------------------------------------------------------- workout in progress

function ActiveWorkout(props: {
  draft: Draft;
  workouts: Workout[];
  incrementOf: (exerciseId: string) => number;
  update: (fn: (d: Draft) => Draft) => void;
  onFinished: () => void;
  onCancel: () => void;
  onCustom: (opts: { name: string; startWeight: string; keep: boolean }) => void;
}) {
  const { draft, workouts, incrementOf, update, onFinished, onCancel, onCustom } = props;
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  async function finish() {
    const w = await finishWorkout(draft);
    if (!w) { setError('Enter the reps for at least one set, then tap Finish.'); return; }
    onFinished();
  }

  return (
    <>
      <h1>{WORKOUT_LABELS[draft.type]}</h1>
      <label className="label" htmlFor="wdate">Date: {formatLongDate(draft.date)}</label>
      <input id="wdate" className="date" type="date" value={draft.date} onChange={(e) => e.target.value && update((d) => ({ ...d, date: e.target.value }))} />

      {draft.entries.map((entry, i) => (
        <ExerciseCard
          key={entry.key}
          entry={entry}
          hint={hintFor(workouts, { id: entry.exerciseId, increment: incrementOf(entry.exerciseId) }, entry.startWeight)}
          isFirst={i === 0}
          isLast={i === draft.entries.length - 1}
          onCell={(row, field, value) => update((d) => setCell(d, entry.key, row, field, value))}
          onAddSet={() => update((d) => addRow(d, entry.key))}
          onRemoveSet={() => update((d) => removeLastRow(d, entry.key))}
          onMove={(dir) => update((d) => moveEntry(d, entry.key, dir))}
          onRemove={() => {
            if (!entryHasData(entry) || window.confirm(`Skip ${entry.name}? The sets you typed will be removed.`)) {
              update((d) => removeEntry(d, entry.key));
            }
          }}
        />
      ))}

      {adding ? (
        <CustomForm onAdd={(o) => { onCustom(o); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>Add another exercise</button>
      )}

      {error && <p className="banner err" role="alert">{error}</p>}
      <button className="btn primary big" onClick={finish}>Finish workout</button>
      <button className="btn danger" onClick={() => window.confirm('Throw away this workout? Nothing will be saved.') && onCancel()}>
        Cancel workout
      </button>
    </>
  );
}

function CustomForm({ onAdd, onCancel }: { onAdd: (o: { name: string; startWeight: string; keep: boolean }) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [keep, setKeep] = useState(false);
  const names = useLiveQuery(() => db.exercises.toArray(), [], []).map((e) => e.name);

  return (
    <section className="card">
      <h2>Add an exercise</h2>
      <label className="label" htmlFor="cname">Exercise name</label>
      <input id="cname" className="text" list="known" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      <datalist id="known">{names.map((n) => <option key={n} value={n} />)}</datalist>

      <label className="label" htmlFor="cweight">Starting weight (lb)</label>
      <input id="cweight" className="num wide" type="text" inputMode="decimal" value={weight} onFocus={(e) => e.target.select()} onChange={(e) => setWeight(sanitizeNumber(e.target.value, true))} />

      <label className="check">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        <span>Keep in this workout going forward</span>
      </label>

      <div className="btns">
        <button className="btn primary" disabled={!name.trim()} onClick={() => onAdd({ name, startWeight: weight, keep })}>Add</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
