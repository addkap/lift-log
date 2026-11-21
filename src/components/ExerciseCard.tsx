import type { DraftEntry } from '../types';
import type { Hint } from '../lib/progression';
import NumberField from './NumberField';

interface Props {
  entry: DraftEntry;
  hint: Hint;
  isFirst: boolean;
  isLast: boolean;
  onCell: (rowIndex: number, field: 'weight' | 'reps', value: string) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/** One exercise: name, last time, suggestion, set rows, and the buttons to change them. */
export default function ExerciseCard({ entry, hint, isFirst, isLast, onCell, onAddSet, onRemoveSet, onMove, onRemove }: Props) {
  const range = entry.minSets === entry.maxSets ? `${entry.minSets}` : `${entry.minSets}-${entry.maxSets}`;
  return (
    <section className="card">
      <h2>{entry.name}</h2>
      <p>Recommended: {range} sets</p>
      <p className="muted">{hint.lastText}</p>
      {hint.suggestionText && <p className="suggest">{hint.suggestionText}</p>}

      <div className="rows">
        <div className="row head">
          <span />
          <span>Weight (lb)</span>
          <span>Reps</span>
        </div>
        {entry.rows.map((r, i) => (
          <div className="row" key={i}>
            <span className="setno">Set {i + 1}</span>
            <NumberField decimal label={`${entry.name} set ${i + 1} weight in pounds`} value={r.weight} onChange={(v) => onCell(i, 'weight', v)} />
            <NumberField label={`${entry.name} set ${i + 1} reps`} value={r.reps} onChange={(v) => onCell(i, 'reps', v)} />
          </div>
        ))}
      </div>

      <div className="btns">
        <button className="btn" onClick={onAddSet}>Add set</button>
        <button className="btn" onClick={onRemoveSet} disabled={entry.rows.length <= 1}>Remove last set</button>
      </div>
      <div className="btns">
        <button className="btn small" onClick={() => onMove(-1)} disabled={isFirst}>Move up</button>
        <button className="btn small" onClick={() => onMove(1)} disabled={isLast}>Move down</button>
        <button className="btn small danger" onClick={onRemove}>Skip exercise</button>
      </div>
    </section>
  );
}
