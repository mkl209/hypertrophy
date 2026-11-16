export type ID = string;
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'light' | 'dark';

export type MealRole = 'breakfast' | 'lunch' | 'pre-workout' | 'post-workout' | 'dinner' | 'bedtime' | 'snack';
export interface MealSlot { id: string; name: string; role: MealRole; time: string; enabled: boolean; relativeToWorkout?: boolean; offsetMinutes?: number }
export interface NutritionSchedule { workoutTime: string; meals: MealSlot[] }

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
  defaultStrategy?: Strategy;
  uiVersion?: number;
  secondaryMuscleWeight: number; // indirect-set contribution, always presented as an estimate
  /** Preferred weekly weighted-set range per muscle; these are guardrails, not targets to automatically reach. */
  muscleVolumePreferences?: Record<string, { min?: number; max?: number }>;
  nutritionSchedule?: NutritionSchedule;
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
  id: 'settings', schemaVersion: 1, setupComplete: false, experience: 'beginner', unit: 'kg', theme: 'dark', uiVersion: 2,
  accent: '#DD403A', secondary: '#F4D35E', surface: '#3E363F', background: '#F6FFF8',
  weekStartsOn: 0, recommendationsEnabled: true, secondaryMuscleWeight: 0.5
};

export const DEFAULT_MUSCLES = ['Chest','Front delts','Side delts','Rear delts','Biceps','Triceps','Forearms','Lats','Upper back','Traps','Spinal erectors','Abdominals','Quadriceps','Hamstrings','Glutes','Adductors','Abductors','Calves'];

export const EQUIPMENT: Equipment[] = ['barbell','dumbbell','cable','machine','smith','plate-loaded','bodyweight','band','kettlebell','other'];

/** Reusable workout definition. Exercise names are snapshotted so renames never break display. */
export interface TemplateExercise { id: ID; exerciseId: ID; exerciseName: string; sets: number; repMin: number; repMax: number; rir: number; restSec: number; notes?: string }
export interface WorkoutTemplate { id: ID; name: string; exercises: TemplateExercise[]; archived: boolean; createdAt: number; updatedAt: number }

/** Reusable week definition (weekday 0 = Monday). */
export interface Microcycle { id: ID; name: string; days: { weekday: number; templateId: ID }[]; archived: boolean; createdAt: number }

export type SequencePattern = 'repeat' | 'alternate' | 'custom';
export type Strategy = 'manual' | 'double' | 'rep' | 'load' | 'volume' | 'hybrid';
/** Volume strategy: extra sets per exercise per week, capped, with an optional deload in the final week. */
export interface Progression { strategy: Strategy; volume?: { weeklySetChange: number; maxExtraSets: number; deloadLastWeek: boolean } }
export interface Mesocycle {
  id: ID; name: string; startDate: string; weeks: number; pattern: SequencePattern;
  sequence: ID[]; // microcycle id for each week, length === weeks
  notes?: string; progression?: Progression; pausedOn?: string; pauses?: { from: string; to: string; weeks: number }[]; status: 'active' | 'completed' | 'archived'; createdAt: number;
}

export type WorkoutStatus = 'scheduled' | 'completed' | 'missed' | 'skipped';
/** A generated occurrence on a real date. Separate from any completed workout record. */
export interface ScheduledWorkout { id: ID; mesocycleId: ID; weekIndex: number; date: string; originalDate: string; templateId: ID; status: WorkoutStatus }

// ---------- Phase 3: logging ----------
export type SetKind = 'warmup' | 'working';
export type SetTechnique = 'myo-reps';
export interface CompletedSet { id: ID; kind: SetKind; technique?: SetTechnique; weight: number; reps: number; rir?: number; note?: string }
/** Snapshot of what was actually done. Never changes when templates or exercises are edited later. */
export interface CompletedExercise { id: ID; exerciseId: ID; exerciseName: string; prescribed: { sets: number; repMin: number; repMax: number; rir: number }; sets: CompletedSet[]; notes?: string }
export interface CompletedWorkout {
  id: ID; scheduledId?: ID; mesocycleId?: ID; templateId?: ID; templateName: string; date: string;
  startedAt: number; finishedAt: number; unit: WeightUnit; exercises: CompletedExercise[]; checkinId?: ID;
}
/** All scales 1–5. Higher = more of the named thing (so for sleep quality, recovery, motivation, readiness, hydration, higher is better). */
export interface PreWorkoutCheckIn {
  id: ID; date: string; scheduledId?: ID; sleepHours: number; sleepQuality: number; fatigue: number; soreness: number; recovery: number;
  stress: number; mentalFatigue: number; motivation: number; readiness: number; jointDiscomfort: number; jointPain: number;
  unwell: boolean; hydration: number; waterL?: number; notes?: string; createdAt: number;
}
export interface PostWorkoutFeedback {
  id: ID; workoutId: ID; pump: number; soreness: number; workload: number; fatigue: number;
  performance: 'below' | 'met' | 'exceeded'; difficulty: 'easy' | 'appropriate' | 'hard'; notes?: string; createdAt: number;
}
export interface DraftSet { id: ID; kind: SetKind; technique?: SetTechnique; weight: string; reps: string; rir: string; done: boolean }
export interface DraftExercise { id: ID; exerciseId: ID; name: string; prescribed: { sets: number; repMin: number; repMax: number; rir: number }; restSec: number; notes?: string; list: DraftSet[] }
export interface WorkoutDraft {
  id: 'current'; scheduledId?: ID; mesocycleId?: ID; templateId?: ID; templateName: string; date: string; startedAt: number;
  stage: 'checkin' | 'feed' | 'log' | 'finish'; checkin?: PreWorkoutCheckIn; exercises: DraftExercise[];
}

// ---------- Phase 5: nutrition ----------
export type NutritionGoal = 'bulk' | 'maintain' | 'cut';
export interface NutritionPhase {
  id: ID; goal: NutritionGoal; name: string; startDate: string; endDate?: string;
  /** Daily calorie target. Always maintenance + adjustment, so anything that reads a target reads this. */
  calories: number;
  protein: number; carbs: number; fat: number; fibre?: number; waterMl?: number; weeklyChange?: number; notes?: string;
  /** Estimated maintenance calories. Phases saved before this field existed don't have it. */
  maintenance?: number;
  /** Surplus (+) or deficit (−) in kcal/day applied to maintenance to get the target. */
  adjustment?: number;
  /** ± kcal that still counts as on target. Defaults to 100 when unset. */
  tolerance?: number;
  /** Optional rest-day targets; absent values fall back to the standard daily target. */
  restDayCalories?: number; restDayProtein?: number; restDayCarbs?: number; restDayFat?: number;
}
export interface FoodEntry { id: ID; date: string; name: string; calories: number; protein: number; carbs: number; fat: number; fibre: number; createdAt: number; mealId?: string; source?: 'manual' | 'open-food-facts'; foodCode?: string; servingGrams?: number }
export interface WaterLog { date: string; ml: number }
export type SupplementEvidence = 'strong' | 'moderate' | 'limited' | 'insufficient' | 'not-rated';
export interface Supplement {
  id: ID; name: string; dose?: number; unit: string; frequency: string; timing: string; notes?: string; archived: boolean;
  category?: string; benefit?: string; evidence?: SupplementEvidence; typicalDose?: string; precautions?: string;
  caffeineMg?: number; costPerUnit?: number; stockQuantity?: number; stockUnit?: string; expiryDate?: string;
  scheduleDays?: number[];
}
export interface SupplementLog { id: ID; supplementId: ID; date: string; taken: boolean; doseTaken?: number; unit?: string; time?: string; caffeineMg?: number; notes?: string }
/** One entry per date. `bodyFat` is an optional estimated percentage (e.g. 15.2). */
export interface BodyweightEntry { date: string; weight: number; bodyFat?: number; notes?: string }
