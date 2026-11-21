// The progression rule. Everything here is a pure function of saved history,
// so suggestions are never stored: edit or delete a past workout and the next
// suggestion simply changes with it.

import type { Exercise, SetRecord, Workout } from '../types';
import { formatShortDate } from './dates';

/** He must hit at least this many reps on his best set... */
export const REPS_TO_PROGRESS = 12;
/** ...and average at least this many across his heaviest sets. */
export const AVG_REPS_TO_PROGRESS = 11.5;

/** 120 -> "120", 122.5 -> "122.5" (no trailing zeros, no float noise). */
export function formatWeight(w: number): string {
  return String(Math.round(w * 100) / 100);
}

/** Sets that count: rows with no reps are ignored. */
export function validSets(sets: SetRecord[]): SetRecord[] {
  return sets.filter((s) => s.reps > 0);
}

/** Only the sets at the heaviest weight used (this ignores light warm-up sets). */
export function topWeightSets(sets: SetRecord[]): SetRecord[] {
  const valid = validSets(sets);
  if (valid.length === 0) return [];
  const max = Math.max(...valid.map((s) => s.weight));
  return valid.filter((s) => s.weight === max);
}

export interface Suggestion {
  weight: number;
  increased: boolean;
  text: string; // the sentence shown on the card
}

/**
 * Given the sets from one saved session, what weight should come next?
 * Returns null if the session has no usable sets. Never suggests a decrease.
 */
export function suggestNext(sets: SetRecord[], increment: number): Suggestion | null {
  const top = topWeightSets(sets);
  if (top.length === 0) return null;

  const weight = top[0].weight;
  const highestReps = Math.max(...top.map((s) => s.reps));
  const avgReps = top.reduce((sum, s) => sum + s.reps, 0) / top.length;

  if (highestReps >= REPS_TO_PROGRESS && avgReps >= AVG_REPS_TO_PROGRESS) {
    const next = Math.round((weight + increment) * 100) / 100;
    return {
      weight: next,
      increased: true,
      text: `Suggested: ${formatWeight(next)} lb (up ${formatWeight(increment)}, you hit 12+ reps)`,
    };
  }
  return { weight, increased: false, text: `Suggested: ${formatWeight(weight)} lb (same)` };
}

export interface LastSession {
  date: string;
  sets: SetRecord[];
}

/**
 * Find the most recent saved session for an exercise (deleted workouts are skipped).
 * `beforeDate` / `excludeId` let the History page ask "what came before this workout?".
 */
export function findLastSession(
  workouts: Workout[],
  exerciseId: string,
  opts: { beforeDate?: string; excludeId?: string } = {},
): LastSession | null {
  let best: { w: Workout; sets: SetRecord[] } | null = null;
  for (const w of workouts) {
    if (w.deletedAt) continue;
    if (opts.excludeId && w.id === opts.excludeId) continue;
    if (opts.beforeDate && w.date >= opts.beforeDate) continue;
    const sets = validSets(w.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets));
    if (sets.length === 0) continue;
    // Newest date wins; same date -> most recently created.
    if (!best || w.date > best.w.date || (w.date === best.w.date && w.createdAt > best.w.createdAt)) {
      best = { w, sets };
    }
  }
  return best ? { date: best.w.date, sets: best.sets } : null;
}

/** "120 lb x 12, 12, 11" (groups consecutive sets with the same weight). */
export function describeSets(sets: SetRecord[]): string {
  const groups: { weight: number; reps: number[] }[] = [];
  for (const s of validSets(sets)) {
    const last = groups[groups.length - 1];
    if (last && last.weight === s.weight) last.reps.push(s.reps);
    else groups.push({ weight: s.weight, reps: [s.reps] });
  }
  return groups.map((g) => `${formatWeight(g.weight)} lb x ${g.reps.join(', ')}`).join('; ');
}

/** What a workout card shows for one exercise. */
export interface Hint {
  lastText: string; // "Last time (Nov 8): 120 lb x 12, 12, 11"  or "No history yet"
  suggestionText: string | null;
  weight: string; // text to prefill into the weight boxes ("" if unknown)
}

export function hintFor(
  workouts: Workout[],
  exercise: Pick<Exercise, 'id' | 'increment'>,
  startWeight?: string,
): Hint {
  const last = findLastSession(workouts, exercise.id);
  const suggestion = last ? suggestNext(last.sets, exercise.increment) : null;
  if (last && suggestion) {
    return {
      lastText: `Last time (${formatShortDate(last.date)}): ${describeSets(last.sets)}`,
      suggestionText: suggestion.text,
      weight: formatWeight(suggestion.weight),
    };
  }
  // No history: use the starting weight he typed for a custom exercise, otherwise leave blank.
  return {
    lastText: 'No history yet',
    suggestionText: startWeight ? `Starting weight: ${startWeight} lb` : null,
    weight: startWeight ?? '',
  };
}
