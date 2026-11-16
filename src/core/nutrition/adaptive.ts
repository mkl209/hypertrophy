import type { BodyweightEntry, FoodEntry, NutritionPhase } from '../types/index.ts';
import { diffDays, todayISO } from '../calendar/dates.ts';
import { sumFoods, weeklyRate } from './nutrition.ts';

export interface CalorieSuggestion {
  status: 'insufficient-data' | 'on-track' | 'adjustment-suggested' | 'no-rate-target';
  message: string;
  currentRate?: number;
  targetRate?: number;
  averageCalories?: number;
  suggestedCalories?: number;
  adjustment?: number;
  loggedDays: number;
  weighIns: number;
}

/** Suggests (never applies) a small calorie change from 28-day weight trend and recent food logs. */
export function adaptiveCalorieSuggestion(
  weights: BodyweightEntry[], foods: FoodEntry[], phase: NutritionPhase, unit: 'kg' | 'lb' = 'kg', asOfDate: string = todayISO(),
): CalorieSuggestion {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  const earliest = latest ? sorted.filter(w => diffDays(latest.date, w.date) <= 28)[0] : undefined;
  const windowFoods = latest ? foods.filter(f => diffDays(latest.date!, f.date) >= 0 && diffDays(latest.date!, f.date) < 14) : [];
  const days = new Set(windowFoods.map(f => f.date));
  const loggedDays = days.size;
  const avg = loggedDays ? sumFoods(windowFoods).calories / loggedDays : undefined;
  const trendEntries = sorted.filter(w => latest && diffDays(latest.date, w.date) <= 28);
  const rate = weeklyRate(trendEntries, 28);
  const minSpan = earliest && latest ? diffDays(latest.date, earliest.date) : 0;
  const result = (status: CalorieSuggestion['status'], message: string, extra: Partial<CalorieSuggestion> = {}): CalorieSuggestion => ({ status, message, loggedDays, weighIns: trendEntries.length, ...(rate !== null ? { currentRate: rate } : {}), ...(avg !== undefined ? { averageCalories: Math.round(avg) } : {}), ...extra });
  if (!latest || diffDays(asOfDate, latest.date) > 7 || trendEntries.length < 5 || minSpan < 21 || rate === null || loggedDays < 10) {
    return result('insufficient-data', 'Keep logging food on most days and weigh in consistently. Use a recent weigh-in (within 7 days), at least 5 weigh-ins across 3 weeks and 10 logged food days in the latest 14 days before assessing intake.');
  }
  const defaultRate = phase.goal === 'bulk' ? latest.weight * 0.002 : phase.goal === 'cut' ? -latest.weight * 0.005 : 0;
  const target = phase.weeklyChange !== undefined && Number.isFinite(phase.weeklyChange) ? phase.weeklyChange : defaultRate;
  const tolerance = Math.max(unit === 'kg' ? 0.05 : 0.1, latest.weight * 0.001);
  const difference = target - rate;
  const targetSource = phase.weeklyChange !== undefined ? 'configured' : 'starting estimate based on your goal';
  if (Math.abs(difference) <= tolerance) return result('on-track', `Your weight trend is within the ${targetSource} weekly rate target. Keep calories unchanged.`, { targetRate: target, suggestedCalories: phase.calories, adjustment: 0 });
  const change = Math.sign(difference) * 100;
  const proposed = Math.max(phase.goal === 'cut' ? 1200 : 1500, phase.calories + change);
  return result('adjustment-suggested', `${rate > target ? 'Weight is changing faster' : 'Weight is changing slower'} than your ${targetSource} target. Consider ${change > 0 ? 'adding' : 'removing'} 100 kcal/day, then reassess after another 2–3 weeks. This is a suggestion, not an automatic change.`, { targetRate: target, suggestedCalories: proposed, adjustment: proposed - phase.calories });
}

export function targetsForDay(phase: NutritionPhase, trainingDay: boolean) {
  if (trainingDay) return { calories: phase.calories, protein: phase.protein, carbs: phase.carbs, fat: phase.fat };
  return {
    calories: phase.restDayCalories ?? phase.calories,
    protein: phase.restDayProtein ?? phase.protein,
    carbs: phase.restDayCarbs ?? phase.carbs,
    fat: phase.restDayFat ?? phase.fat,
  };
}
