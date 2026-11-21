// Database actions. The React pages call these; the pure logic lives in src/lib.
import { db } from './db';
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from './lib/defaults';
import { addEntry, buildDraft, draftToWorkout, newEntry } from './lib/draft';
import { newId } from './lib/ids';
import { hintFor } from './lib/progression';
import type { Draft, Workout, WorkoutType } from './types';

/** First run: load the preloaded exercises and workouts. Safe to call every startup. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.templates, async () => {
    if ((await db.exercises.count()) === 0) await db.exercises.bulkAdd(DEFAULT_EXERCISES);
    if ((await db.templates.count()) === 0) await db.templates.bulkAdd(DEFAULT_TEMPLATES);
  });
}

export const loadDraft = () => db.drafts.get('current');
export const saveDraft = (d: Draft) => db.drafts.put(d);
export const discardDraft = () => db.drafts.delete('current');

/** Start a workout: build the draft from the template and save it right away. */
export async function startWorkout(type: WorkoutType, date: string): Promise<Draft> {
  const template = await db.templates.get(type);
  if (!template) throw new Error('Missing template ' + type);
  const [exercises, workouts] = await Promise.all([db.exercises.toArray(), db.workouts.toArray()]);
  const draft = buildDraft(type, date, template, exercises, workouts);
  await saveDraft(draft);
  return draft;
}

/** Finish: save the workout, clear the draft. Returns null (and saves nothing) if no reps were entered. */
export async function finishWorkout(draft: Draft): Promise<Workout | null> {
  const workout = draftToWorkout(draft);
  if (!workout) return null;
  await db.transaction('rw', db.workouts, db.drafts, async () => {
    await db.workouts.add(workout);
    await db.drafts.delete('current');
  });
  return workout;
}

/**
 * Add a custom exercise to today's workout. If the name matches an existing exercise
 * (ignoring capitals) we reuse it, so its history is shared. Otherwise a new exercise is created
 * so it shows up in stats. "keep" also adds it to this workout type's template.
 */
export async function addCustomExercise(
  draft: Draft,
  opts: { name: string; startWeight: string; keep: boolean },
): Promise<Draft> {
  const name = opts.name.trim();
  const now = Date.now();
  const all = await db.exercises.toArray();
  let ex = all.find((e) => !e.deletedAt && e.name.toLowerCase() === name.toLowerCase());
  if (!ex) {
    ex = { id: newId(), name, increment: 5, updatedAt: now };
    await db.exercises.add(ex);
  }

  // Prefill from history if the exercise already has some.
  const workouts = await db.workouts.toArray();
  const hint = hintFor(workouts, ex, opts.startWeight || undefined);

  const minSets = 2;
  const maxSets = 3;
  const entry = newEntry(ex, minSets, maxSets, hint.weight, opts.startWeight || undefined);

  if (opts.keep) {
    const template = await db.templates.get(draft.type);
    if (template && !template.items.some((i) => i.exerciseId === ex!.id)) {
      template.items.push({ exerciseId: ex.id, minSets, maxSets });
      template.updatedAt = now;
      await db.templates.put(template);
    }
  }
  return addEntry(draft, entry);
}

export async function setIncrement(exerciseId: string, increment: number): Promise<void> {
  await db.exercises.update(exerciseId, { increment, updatedAt: Date.now() });
}

export async function setSetRange(type: WorkoutType, exerciseId: string, minSets: number, maxSets: number) {
  const t = await db.templates.get(type);
  if (!t) return;
  t.items = t.items.map((i) => (i.exerciseId === exerciseId ? { ...i, minSets, maxSets } : i));
  t.updatedAt = Date.now();
  await db.templates.put(t);
}
