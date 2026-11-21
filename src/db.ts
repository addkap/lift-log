// Local database (IndexedDB via Dexie). This is the source of truth for the app.
import Dexie, { type Table } from 'dexie';
import type { Draft, Exercise, SyncMeta, Template, Workout } from './types';

class LiftDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  workouts!: Table<Workout, string>;
  drafts!: Table<Draft, string>;
  meta!: Table<SyncMeta, string>;

  constructor() {
    super('lift-log');
    // Only indexed fields are listed here; other fields are stored automatically.
    this.version(1).stores({
      exercises: 'id',
      templates: 'id',
      workouts: 'id, date, updatedAt',
      drafts: 'id',
    });
    // Version 2 adds the OneDrive sync settings table.
    this.version(2).stores({
      exercises: 'id',
      templates: 'id',
      workouts: 'id, date, updatedAt',
      drafts: 'id',
      meta: 'id',
    });
  }
}

export const db = new LiftDB();
