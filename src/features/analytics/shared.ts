import type { BodyweightEntry, CompletedWorkout, Exercise, FoodEntry, Mesocycle, MuscleGroup, NutritionPhase, PostWorkoutFeedback, PreWorkoutCheckIn, ScheduledWorkout, UserSettings } from '../../core/types/index.ts';
export interface Data {
  workouts: CompletedWorkout[]; exercises: Exercise[]; muscles: MuscleGroup[]; settings: UserSettings; mesos: Mesocycle[]; scheduled: ScheduledWorkout[];
  checkins: PreWorkoutCheckIn[]; feedback: PostWorkoutFeedback[]; foods: FoodEntry[]; weights: BodyweightEntry[]; phases: NutritionPhase[];
}
export const COLORS = ['#DD403A', '#3E88C9', '#2e9e5b', '#F4B400', '#8E5BC9', '#7a727b'];
export const f1 = (n: number | null | undefined, d = 1): string => (n === null || n === undefined ? '–' : n.toFixed(d));
export const pct = (n: number | null): string => (n === null ? '–' : `${Math.round(n * 100)}%`);
