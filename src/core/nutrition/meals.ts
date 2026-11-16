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
  const consumed = sumFoods(loggedFoods);
  const loggedByMeal = active.map(meal => sumFoods(loggedFoods.filter(food => food.mealId === meal.id)));
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
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const weighted = (total: number, macro: 'protein'|'carbs'|'fat'|'fibre') => {
    const ws = active.map(m => weights(m.role, macro));
    const sum = ws.reduce((a,b) => a+b, 0) || 1;
    let left = round1(total);
    return ws.map((weight, i) => {
      const value = i === ws.length - 1 ? left : Math.min(left, round1(total * weight / sum));
      left = round1(left - value);
      return value;
    });
  };
  /** Subtract food already logged in each meal, then scale remaining deficits if food was unassigned or a meal overshot. */
  const remainingByMeal = (total: number, macro: 'protein'|'carbs'|'fat'|'fibre', initial: number[]) => {
    const totalRemaining = round1(Math.max(0, total - consumed[macro]));
    const deficits = initial.map((target, i) => Math.max(0, target - loggedByMeal[i][macro]));
    const deficitTotal = deficits.reduce((a,b) => a+b, 0);
    if (deficitTotal <= 0 || totalRemaining <= 0) return active.map(() => 0);
    let left = totalRemaining;
    return deficits.map((deficit, i) => {
      const value = i === deficits.length - 1 ? left : Math.min(left, round1(totalRemaining * deficit / deficitTotal));
      left = round1(left - value);
      return value;
    });
  };
  const op = weighted(phase.protein, 'protein'), oc = weighted(phase.carbs, 'carbs'), of = weighted(phase.fat, 'fat'), oi = weighted(phase.fibre ?? 0, 'fibre');
  const p = remainingByMeal(phase.protein, 'protein', op), c = remainingByMeal(phase.carbs, 'carbs', oc), f = remainingByMeal(phase.fat, 'fat', of), fi = remainingByMeal(phase.fibre ?? 0, 'fibre', oi);
  return active.map((meal, i) => ({ meal, protein:p[i], carbs:c[i], fat:f[i], fibre:fi[i], calories:Math.round(p[i]*4+c[i]*4+f[i]*9), redistributed:loggedFoods.length > 0 }));
}
