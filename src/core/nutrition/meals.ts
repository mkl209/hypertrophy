import type { FoodEntry, MealSlot, NutritionPhase, NutritionSchedule } from '../types/index.ts';
import { sumFoods } from './nutrition.ts';

export const DEFAULT_NUTRITION_SCHEDULE: NutritionSchedule = {
  workoutTime: '20:00',
  meals: [
    { id: 'breakfast', name: 'Breakfast', role: 'breakfast', time: '08:00', enabled: true },
    { id: 'lunch', name: 'Lunch', role: 'lunch', time: '13:00', enabled: true },
    { id: 'dinner', name: 'Dinner', role: 'dinner', time: '17:00', enabled: true },
    { id: 'pre-workout', name: 'Pre-workout', role: 'pre-workout', time: '18:30', enabled: true, relativeToWorkout: true, offsetMinutes: -90 },
    { id: 'post-workout', name: 'Post-workout', role: 'post-workout', time: '21:00', enabled: true, relativeToWorkout: true, offsetMinutes: 60 },
    { id: 'bedtime', name: 'Before bed', role: 'bedtime', time: '23:00', enabled: true }
  ]
};

export function scheduleOf(schedule?: NutritionSchedule): NutritionSchedule {
  if (!schedule) return structuredClone(DEFAULT_NUTRITION_SCHEDULE);
  return { workoutTime: /^\d{2}:\d{2}$/.test(schedule.workoutTime) ? schedule.workoutTime : '20:00', meals: Array.isArray(schedule.meals) ? schedule.meals : structuredClone(DEFAULT_NUTRITION_SCHEDULE.meals) };
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function mealTime(meal: MealSlot, schedule: NutritionSchedule): string {
  return meal.relativeToWorkout ? addMinutes(schedule.workoutTime, meal.offsetMinutes ?? 0) : meal.time;
}

/** RP-inspired allocation heuristic: protein is spread evenly; carbohydrate is biased toward training; fats and fibre are lower around training. Not RP's proprietary algorithm. */
export function allocateMealTargets(phase: NutritionPhase, meals: MealSlot[], loggedFoods: FoodEntry[] = []) {
  const active = meals.filter(m => m.enabled);
  if (!active.length) return [];
  const completedMealIds = new Set(loggedFoods.map(f => f.mealId).filter((id): id is string => !!id));
  const pending = active.filter(m => !completedMealIds.has(m.id));
  const consumed = sumFoods(loggedFoods);
  const remaining = { protein: Math.max(0, phase.protein - consumed.protein), carbs: Math.max(0, phase.carbs - consumed.carbs), fat: Math.max(0, phase.fat - consumed.fat), fibre: Math.max(0, (phase.fibre ?? 0) - consumed.fibre) };
  const weights = (role: MealSlot['role'], macro: 'protein'|'carbs'|'fat'|'fibre') => {
    const table: Record<string, Record<string, number>> = {
      'breakfast': { protein: 1, carbs: 1.0, fat: 1.15, fibre: 1.1 },
      'lunch': { protein: 1, carbs: 1.15, fat: 1.15, fibre: 1.2 },
      'pre-workout': { protein: 1, carbs: 1.35, fat: 0.35, fibre: 0.3 },
      'post-workout': { protein: 1, carbs: 1.4, fat: 0.65, fibre: 0.55 },
      'dinner': { protein: 1, carbs: 1.05, fat: 1.2, fibre: 1.25 },
      'bedtime': { protein: 1.1, carbs: 0.65, fat: 0.8, fibre: 0.65 },
      'snack': { protein: 0.8, carbs: 0.8, fat: 0.8, fibre: 0.7 }
    };
    return table[role]?.[macro] ?? 1;
  };
  const distribute = (total: number, macro: 'protein'|'carbs'|'fat'|'fibre') => {
    const ws = pending.map(m => weights(m.role, macro)); const sum = ws.reduce((a,b) => a+b, 0) || 1;
    let left = Math.round(total);
    return pending.map((_, i) => { const value = i === pending.length - 1 ? left : Math.round(total * ws[i] / sum); left -= value; return value; });
  };
  const p = distribute(remaining.protein, 'protein'), c = distribute(remaining.carbs, 'carbs'), f = distribute(remaining.fat, 'fat'), fi = distribute(remaining.fibre, 'fibre');
  const redistributed = new Map(pending.map((meal, i) => [meal.id, { protein: p[i], carbs: c[i], fat: f[i], fibre: fi[i] }]));
  const original = (macro: 'protein'|'carbs'|'fat'|'fibre') => { const ws = active.map(m => weights(m.role, macro)); const sum = ws.reduce((a,b) => a+b, 0); return active.map((_, i) => Math.round(((phase[macro] ?? 0) as number) * ws[i] / sum)); };
  const op = original('protein'), oc = original('carbs'), of = original('fat'), oi = original('fibre');
  return active.map((meal, i) => { const target = redistributed.get(meal.id) ?? { protein: op[i], carbs: oc[i], fat: of[i], fibre: oi[i] }; return { meal, ...target, calories: Math.round(target.protein*4+target.carbs*4+target.fat*9), redistributed: !completedMealIds.has(meal.id) && loggedFoods.length > 0 }; });
}
