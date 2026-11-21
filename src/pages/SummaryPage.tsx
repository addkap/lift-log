import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../db';
import { formatShortDate, formatWeekday, todayLocal } from '../lib/dates';
import { formatWeight } from '../lib/progression';
import { RANGES, exerciseSessions, exerciseStats, loggedExercises, rangeStart, summarize, type Range } from '../lib/stats';
import { WORKOUT_LABELS, type WorkoutType } from '../types';

// Bills colours for the charts.
const BLUE = '#00338d';
const RED = '#c60c30';
const TICK = { fontSize: 15, fill: '#0a1020' };

export default function SummaryPage() {
  const workouts = useLiveQuery(() => db.workouts.toArray(), [], []);
  const [range, setRange] = useState<Range>('3m');
  const [pick, setPick] = useState<string>('');
  const today = todayLocal();

  const summary = summarize(workouts, range, today);
  // 1 week shows a bar per day (Mon-Sun); longer ranges show a bar per week.
  const oneWeek = range === '1w';
  const weekData = oneWeek
    ? summary.days.map((d) => ({ label: formatWeekday(d.date), count: d.count }))
    : summary.weeks.map((w) => ({ label: formatShortDate(w.week), count: w.count }));

  const exercises = loggedExercises(workouts);
  const exerciseId = exercises.some((e) => e.id === pick) ? pick : exercises[0]?.id;
  const start = rangeStart(range, today, workouts);
  const points = exerciseId ? exerciseSessions(workouts, exerciseId).filter((p) => p.date >= start) : [];
  const stats = exerciseStats(points);
  const pointData = points.map((p) => ({ label: formatShortDate(p.date), weight: p.weight, volume: p.volume }));

  return (
    <>
      <h1>Summary</h1>

      <div className="range" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.id} className={r.id === range ? 'selected' : ''} aria-pressed={r.id === range} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="tiles">
        <div className="tile"><span className="big-number">{summary.total}</span>Total workouts</div>
        <div className="tile"><span className="big-number">{summary.avgPerWeek.toFixed(1)}</span>Average per week</div>
        <div className="tile wide"><span className="big-number">{summary.weeksWith2Plus}</span>Weeks with 2 or more workouts</div>
      </div>

      <section className="card">
        <h2>{oneWeek ? 'Workouts this week' : 'Workouts per week'}</h2>
        <p className="muted">{oneWeek ? 'Each bar is one day, Monday to Sunday.' : 'Each bar is one week, Monday to Sunday.'}</p>
        <div className="chart" role="img" aria-label={oneWeek ? 'Bar chart of workouts per day this week' : 'Bar chart of workouts per week'}>
          <ResponsiveContainer>
            <BarChart data={weekData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={TICK} interval={oneWeek ? 0 : "preserveStartEnd"} minTickGap={24} />
              <YAxis allowDecimals={false} tick={TICK} width={40} />
              <Tooltip />
              <Bar dataKey="count" name="Workouts" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>By workout type</h2>
        {(['lower', 'upper', 'full'] as WorkoutType[]).map((t) => (
          <div className="type-line" key={t}><span>{WORKOUT_LABELS[t]}</span><span>{summary.byType[t]}</span></div>
        ))}
      </section>

      <section className="card">
        <h2>Exercise progress</h2>
        {exercises.length === 0 ? (
          <p>Save a workout to see exercise charts.</p>
        ) : (
          <>
            <label className="label" htmlFor="exercise">Exercise</label>
            <select id="exercise" className="select" value={exerciseId} onChange={(e) => setPick(e.target.value)}>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>

            {!stats ? (
              <p>No sets for this exercise in this time range.</p>
            ) : (
              <>
                <div className="tiles">
                  <div className="tile"><span className="big-number">{formatWeight(stats.best)}</span>Best weight (lb)</div>
                  <div className="tile"><span className="big-number">{stats.avgRepsPerSet.toFixed(1)}</span>Average reps per set</div>
                </div>

                <h2>Weight over time</h2>
                <div className="chart" role="img" aria-label="Line chart of weight over time">
                  <ResponsiveContainer>
                    <LineChart data={pointData} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={TICK} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis tick={TICK} width={48} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="weight" name="Weight (lb)" stroke={RED} strokeWidth={3} dot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <h2>Total volume per workout</h2>
                <p className="muted">Sets × reps × weight, in pounds.</p>
                <div className="chart" role="img" aria-label="Bar chart of total volume per workout">
                  <ResponsiveContainer>
                    <BarChart data={pointData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={TICK} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis tick={TICK} width={56} />
                      <Tooltip />
                      <Bar dataKey="volume" name="Volume (lb)" fill={BLUE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
