export type ID = string;
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'light' | 'dark';

export interface UserSettings {
  id: 'settings';
  schemaVersion: number;
  setupComplete: boolean;
  experience: ExperienceLevel;
  unit: WeightUnit;
  theme: ThemeMode;
  accent: string;
  secondary: string;
  surface: string;
  background: string;
  weekStartsOn: 0; // Monday (fixed for now)
  recommendationsEnabled: boolean;
  secondaryMuscleWeight: number; // indirect-set contribution, always presented as an estimate
}

export interface MuscleGroup { id: ID; name: string; custom: boolean; archived: boolean }

export type Equipment = 'barbell'|'dumbbell'|'cable'|'machine'|'smith'|'plate-loaded'|'bodyweight'|'band'|'kettlebell'|'other';

export interface Exercise {
  id: ID;
  name: string;
  description?: string;
  category?: string;
  mechanic: 'compound' | 'isolation';
  laterality: 'bilateral' | 'unilateral';
  movementPattern?: string;
  equipment: Equipment[];
  primaryMuscles: ID[];
  secondaryMuscles: ID[];
  defaults: { repMin?: number; repMax?: number; rir?: number; restSec?: number; sets?: number; increment?: number; notes?: string };
  archived: boolean;
  builtIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'settings', schemaVersion: 1, setupComplete: false, experience: 'beginner', unit: 'kg', theme: 'light',
  accent: '#DD403A', secondary: '#F4D35E', surface: '#3E363F', background: '#F6FFF8',
  weekStartsOn: 0, recommendationsEnabled: true, secondaryMuscleWeight: 0.5
};

export const DEFAULT_MUSCLES = ['Chest','Front delts','Side delts','Rear delts','Biceps','Triceps','Forearms','Lats','Upper back','Traps','Spinal erectors','Abdominals','Quadriceps','Hamstrings','Glutes','Adductors','Abductors','Calves'];
