// Shared data types. Everything that will sync later has an `id` and `updatedAt`.

export type WorkoutType = 'lower' | 'upper' | 'full';

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  lower: 'Lower Body',
  upper: 'Upper Body',
  full: 'Full Body',
};

/** One machine/movement. Shared by every workout type, so history is shared too. */
export interface Exercise {
  id: string;
  name: string;
  increment: number; // pounds added when he earns an increase (default 5)
  updatedAt: number;
  deletedAt?: number; // tombstone (used by sync later)
}

/** One line in a workout template: which exercise, and the recommended set range. */
export interface TemplateItem {
  exerciseId: string;
  minSets: number;
  maxSets: number;
}

/** The default exercise list for Lower / Upper / Full. The id is the workout type. */
export interface Template {
  id: WorkoutType;
  items: TemplateItem[];
  updatedAt: number;
}

export interface SetRecord {
  weight: number;
  reps: number;
}

export interface WorkoutEntry {
  exerciseId: string;
  name: string; // name at the time of saving, so old workouts still read well
  sets: SetRecord[];
}

/** A saved workout. */
export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD in local time
  type: WorkoutType;
  entries: WorkoutEntry[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// ---- In-progress workout ("draft"). Lives only on this device. ----

/** Inputs are kept as text while typing so "12." or an empty box works fine. */
export interface DraftRow {
  weight: string;
  reps: string;
}

export interface DraftEntry {
  key: string; // unique within the draft (so the same exercise could appear twice)
  exerciseId: string;
  name: string;
  minSets: number;
  maxSets: number;
  startWeight?: string; // for a custom exercise with no history yet
  rows: DraftRow[];
}

export interface Draft {
  id: 'current'; // there is only ever one draft
  type: WorkoutType;
  date: string;
  entries: DraftEntry[];
  updatedAt: number;
}

// ---- OneDrive sync settings (this device only, never uploaded) ----

/** The OneDrive folder that holds lift-log-data.json. */
export interface FolderRef {
  driveId: string;
  itemId: string;
  name: string;
}

export interface SyncMeta {
  id: 'sync';
  folder?: FolderRef;
  syncedSig?: string; // fingerprint of the data as of the last successful sync (see merge.ts: signature)
  lastSync?: number; // time of the last successful sync
}
