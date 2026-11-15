import Dexie, { type Table } from 'dexie';
import { DEFAULT_MUSCLES, DEFAULT_SETTINGS, type Equipment, type Exercise, type Mesocycle, type Microcycle, type MuscleGroup, type ScheduledWorkout, type UserSettings, type WorkoutTemplate } from '../core/types/index.ts';

export class AppDB extends Dexie {
  settings!: Table<UserSettings, string>;
  muscles!: Table<MuscleGroup, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  microcycles!: Table<Microcycle, string>;
  mesocycles!: Table<Mesocycle, string>;
  scheduled!: Table<ScheduledWorkout, string>;
  constructor() {
    super('hypertrophy-coach');
    // Later phases add tables via db.version(2).stores({...}); never edit a shipped version.
    this.version(1).stores({
      settings: 'id',
      muscles: 'id, name',
      exercises: 'id, name, archived'
    });
    this.version(2).stores({
      templates: 'id, name, archived',
      microcycles: 'id, name, archived',
      mesocycles: 'id, startDate, status',
      scheduled: 'id, mesocycleId, date'
    });
  }
}
export const db = new AppDB();

export const newId = (): string => crypto.randomUUID();

/** Idempotent first-run seeding. */
export async function initDb(): Promise<void> {
  if (!(await db.settings.get('settings'))) await db.settings.put(DEFAULT_SETTINGS);
  if ((await db.muscles.count()) === 0) {
    await db.muscles.bulkPut(DEFAULT_MUSCLES.map(name => ({ id: mid(name), name, custom: false, archived: false })));
  }
  await seedExercises();
}

const mid = (n: string) => `muscle-${n.toLowerCase().replace(/\s+/g, '-')}`;
type Seed = [string, 'compound' | 'isolation', Equipment[], string[], string[], number, number, number];
const SEED: Seed[] = [
  ['Barbell Bench Press', 'compound', ['barbell'], ['Chest'], ['Front delts', 'Triceps'], 6, 10, 2.5],
  ['Incline Dumbbell Press', 'compound', ['dumbbell'], ['Chest'], ['Front delts', 'Triceps'], 8, 12, 2],
  ['Barbell Back Squat', 'compound', ['barbell'], ['Quadriceps', 'Glutes'], ['Adductors', 'Spinal erectors'], 5, 8, 2.5],
  ['Leg Press', 'compound', ['machine', 'plate-loaded'], ['Quadriceps'], ['Glutes', 'Adductors'], 8, 12, 5],
  ['Romanian Deadlift', 'compound', ['barbell'], ['Hamstrings', 'Glutes'], ['Spinal erectors'], 6, 10, 2.5],
  ['Lying Leg Curl', 'isolation', ['machine'], ['Hamstrings'], [], 10, 15, 2.5],
  ['Leg Extension', 'isolation', ['machine'], ['Quadriceps'], [], 10, 15, 2.5],
  ['Standing Calf Raise', 'isolation', ['machine'], ['Calves'], [], 10, 15, 2.5],
  ['Lat Pulldown', 'compound', ['cable', 'machine'], ['Lats'], ['Biceps', 'Upper back'], 8, 12, 2.5],
  ['Pull-Up', 'compound', ['bodyweight'], ['Lats'], ['Biceps', 'Upper back'], 6, 10, 1],
  ['Chest-Supported Row', 'compound', ['machine'], ['Upper back', 'Lats'], ['Biceps', 'Rear delts'], 8, 12, 2.5],
  ['Seated Cable Row', 'compound', ['cable'], ['Upper back', 'Lats'], ['Biceps', 'Rear delts'], 8, 12, 2.5],
  ['Overhead Press', 'compound', ['barbell'], ['Front delts'], ['Triceps', 'Side delts'], 6, 10, 2.5],
  ['Dumbbell Lateral Raise', 'isolation', ['dumbbell'], ['Side delts'], [], 10, 20, 1],
  ['Rear Delt Fly', 'isolation', ['cable', 'machine'], ['Rear delts'], ['Upper back'], 12, 20, 2.5],
  ['Cable Triceps Pushdown', 'isolation', ['cable'], ['Triceps'], [], 8, 15, 2.5],
  ['Overhead Cable Triceps Extension', 'isolation', ['cable'], ['Triceps'], [], 8, 15, 2.5],
  ['Dumbbell Curl', 'isolation', ['dumbbell'], ['Biceps'], ['Forearms'], 8, 12, 1],
  ['Hip Thrust', 'compound', ['barbell'], ['Glutes'], ['Hamstrings'], 8, 12, 2.5],
  ['Cable Crunch', 'isolation', ['cable'], ['Abdominals'], [], 10, 15, 2.5]
];
async function seedExercises(): Promise<void> {
  if ((await db.exercises.count()) > 0) return;
  const now = Date.now();
  await db.exercises.bulkPut(SEED.map(([name, mechanic, equipment, prim, sec, repMin, repMax, increment]) => ({
    id: `ex-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, mechanic, laterality: 'bilateral' as const, equipment,
    primaryMuscles: prim.map(mid), secondaryMuscles: sec.map(mid),
    defaults: { repMin, repMax, rir: 2, restSec: mechanic === 'compound' ? 150 : 90, sets: 3, increment },
    archived: false, builtIn: true, createdAt: now, updatedAt: now
  })));
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<void> {
  await db.settings.update('settings', patch);
}
