import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { setIncrement, setSetRange } from '../store';
import { sanitizeNumber } from '../lib/draft';
import { WORKOUT_LABELS, type WorkoutType } from '../types';
import BackupSettings from '../components/BackupSettings';
import OneDriveSettings from '../components/OneDriveSettings';

/** A number box that saves when you leave it. Empty or 0 puts the old value back. */
function SettingNumber(props: { label: string; value: number; decimal?: boolean; onSave: (n: number) => void }) {
  const { label, value, decimal, onSave } = props;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      className="num"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setText(sanitizeNumber(e.target.value, !!decimal))}
      onBlur={() => {
        const n = parseFloat(text);
        if (n > 0) onSave(n);
        else setText(String(value));
      }}
    />
  );
}

/** Is the browser promising to keep our saved data? (iPhone only does this for Home Screen apps.) */
function useStorageProtected(): boolean | null {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setState).catch(() => setState(null));
  }, []);
  return state;
}

export default function SettingsPage() {
  const protectedStorage = useStorageProtected();
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const templates = useLiveQuery(() => db.templates.toArray(), [], []);
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;

  return (
    <>
      <h1>Settings</h1>

      <section className="card">
        <h2>Weight increase</h2>
        <p className="muted">How many pounds to add when he earns an increase.</p>
        {exercises.filter((e) => !e.deletedAt).map((e) => (
          <div className="setting" key={e.id}>
            <span>{e.name}</span>
            <SettingNumber decimal label={`${e.name} increase in pounds`} value={e.increment} onSave={(n) => setIncrement(e.id, n)} />
          </div>
        ))}
      </section>

      {(['lower', 'upper', 'full'] as WorkoutType[]).map((type) => {
        const t = templates.find((x) => x.id === type);
        if (!t) return null;
        return (
          <section className="card" key={type}>
            <h2>{WORKOUT_LABELS[type]}: sets</h2>
            <p className="muted">Recommended range (from – to).</p>
            {t.items.map((item) => (
              <div className="setting" key={item.exerciseId}>
                <span>{nameOf(item.exerciseId)}</span>
                <div className="pair">
                  <SettingNumber label={`${nameOf(item.exerciseId)} minimum sets`} value={item.minSets} onSave={(n) => setSetRange(type, item.exerciseId, n, Math.max(n, item.maxSets))} />
                  <SettingNumber label={`${nameOf(item.exerciseId)} maximum sets`} value={item.maxSets} onSave={(n) => setSetRange(type, item.exerciseId, Math.min(n, item.minSets), n)} />
                </div>
              </div>
            ))}
          </section>
        );
      })}

      <section className="card">
        <h2>Phone storage</h2>
        {protectedStorage ? (
          <p>Protected: the phone will keep your workouts safe.</p>
        ) : (
          <p>Not protected yet. Add Lift Log to the Home Screen so the phone keeps your workouts safe.</p>
        )}
      </section>

      <OneDriveSettings />
      <BackupSettings />
    </>
  );
}
