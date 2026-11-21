import 'fake-indexeddb/auto'; // must come first: gives Dexie an in-memory IndexedDB for tests
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addRow, removeEntry, setCell } from './lib/draft';
import { addCustomExercise, ensureSeeded, finishWorkout, loadDraft, saveDraft, setIncrement, startWorkout } from './store';

beforeEach(async () => {
  await Promise.all([db.exercises.clear(), db.templates.clear(), db.workouts.clear(), db.drafts.clear()]);
  await ensureSeeded();
});

describe('store', () => {
  it('seeds once', async () => {
    await ensureSeeded();
    expect(await db.exercises.count()).toBe(11);
    expect(await db.templates.count()).toBe(3);
  });

  it('autosaves the draft and finishing saves a workout and clears the draft', async () => {
    let d = await startWorkout('lower', '2026-11-21');
    d = setCell(d, d.entries[0].key, 0, 'weight', '120');
    d = setCell(d, d.entries[0].key, 0, 'reps', '12');
    await saveDraft(d);
    expect((await loadDraft())!.entries[0].rows[0].reps).toBe('12'); // survives a "browser close"

    const w = await finishWorkout(d);
    expect(w).not.toBeNull();
    expect(await db.workouts.count()).toBe(1);
    expect(await loadDraft()).toBeUndefined();
  });

  it('finishing with no reps saves nothing', async () => {
    const d = await startWorkout('upper', '2026-11-21');
    expect(await finishWorkout(d)).toBeNull();
    expect(await db.workouts.count()).toBe(0);
    expect(await loadDraft()).toBeDefined();
  });

  it('removing an exercise from today leaves the template alone', async () => {
    let d = await startWorkout('lower', '2026-11-21');
    d = removeEntry(d, d.entries[0].key);
    expect(d.entries).toHaveLength(4);
    expect((await db.templates.get('lower'))!.items).toHaveLength(5);
  });

  it('custom exercise for today only: tracked, but not added to the template', async () => {
    let d = await startWorkout('lower', '2026-11-21');
    d = await addCustomExercise(d, { name: 'Leg press', startWeight: '90', keep: false });
    const entry = d.entries[d.entries.length - 1];
    expect(entry.rows[0].weight).toBe('90');
    expect((await db.templates.get('lower'))!.items).toHaveLength(5);
    expect(await db.exercises.get(entry.exerciseId)).toBeDefined();
  });

  it('custom exercise with "keep going forward" joins the template', async () => {
    let d = await startWorkout('lower', '2026-11-21');
    d = await addCustomExercise(d, { name: 'Leg press', startWeight: '90', keep: true });
    const items = (await db.templates.get('lower'))!.items;
    expect(items).toHaveLength(6);
    expect(items[5].exerciseId).toBe(d.entries[5].exerciseId);
  });

  it('a custom exercise named like an existing one shares its history', async () => {
    let d = await startWorkout('upper', '2026-11-21');
    d = await addCustomExercise(d, { name: 'hack SQUAT', startWeight: '', keep: false });
    expect(d.entries[d.entries.length - 1].exerciseId).toBe('hack-squat');
    expect(await db.exercises.count()).toBe(11);
  });

  it('next workout uses the saved history and the exercise increment', async () => {
    await setIncrement('hack-squat', 2.5);
    let d = await startWorkout('lower', '2026-11-08');
    const key = d.entries[0].key;
    d = addRow(d, key); // 4 sets; fine
    for (const [i, reps] of ['12', '12', '12'].entries()) {
      d = setCell(d, key, i, 'weight', '120');
      d = setCell(d, key, i, 'reps', reps);
    }
    await finishWorkout(d);
    const next = await startWorkout('full', '2026-11-15'); // shared exercise carries across types
    expect(next.entries[0].exerciseId).toBe('hack-squat');
    expect(next.entries[0].rows[0].weight).toBe('122.5');
  });
});
