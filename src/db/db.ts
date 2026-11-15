import Dexie, { type Table } from 'dexie';
import { DEFAULT_MUSCLES, DEFAULT_SETTINGS, type Exercise, type MuscleGroup, type UserSettings } from '../core/types/index.ts';

export class AppDB extends Dexie {
  settings!: Table<UserSettings, string>;
  muscles!: Table<MuscleGroup, string>;
  exercises!: Table<Exercise, string>;
  constructor() {
    super('hypertrophy-coach');
    // Later phases add tables via db.version(2).stores({...}); never edit a shipped version.
    this.version(1).stores({
      settings: 'id',
      muscles: 'id, name',
      exercises: 'id, name, archived'
    });
  }
}
export const db = new AppDB();

export const newId = (): string => crypto.randomUUID();

/** Idempotent first-run seeding. */
export async function initDb(): Promise<void> {
  if (!(await db.settings.get('settings'))) await db.settings.put(DEFAULT_SETTINGS);
  if ((await db.muscles.count()) === 0) {
    await db.muscles.bulkPut(DEFAULT_MUSCLES.map(name => ({ id: `muscle-${name.toLowerCase().replace(/\s+/g, '-')}`, name, custom: false, archived: false })));
  }
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<void> {
  await db.settings.update('settings', patch);
}
