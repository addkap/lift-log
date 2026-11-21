// Local database (IndexedDB via Dexie). This is the source of truth for the app.
import Dexie, { type Table } from 'dexie';
import type { Draft, Exercise, Template, Workout } from './types';

class LiftDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  workouts!: Table<Workout, string>;
  drafts!: Table<Draft, string>;

  constructor() {
    super('lift-log');
    // Only indexed fields are listed here; other fields are stored automatically.
    this.version(1).stores({
      exercises: 'id',
      templates: 'id',
      workouts: 'id, date, updatedAt',
      drafts: 'id',
    });
  }
}

export const db = new LiftDB();
