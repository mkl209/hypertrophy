import { addDays, diffDays, startOfWeekMonday, type ISODate } from '../calendar/dates.ts';
import type { BodyweightEntry, FoodEntry, NutritionPhase } from '../types/index.ts';

export interface Macros { calories: number; protein: number; carbs: number; fat: number; fibre: number }
export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
export const kcalFromMacros = (p: number, c: number, f: number): number => Math.round(p * 4 + c * 4 + f * 9);

export function sumFoods(foods: FoodEntry[]): Macros {
  return foods.reduce((t, f) => ({ calories: t.calories + f.calories, protein: t.protein + f.protein, carbs: t.carbs + f.carbs, fat: t.fat + f.fat, fibre: t.fibre + f.fibre }), { ...ZERO });
}

/** The phase covering a date. If phases overlap, the one that started most recently wins. */
export function phaseForDate(phases: NutritionPhase[], date: ISODate): NutritionPhase | undefined {
  return phases.filter(p => p.startDate <= date && (!p.endDate || date <= p.endDate)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export function remaining(target: Pick<Macros, 'calories' | 'protein' | 'carbs' | 'fat'>, t: Macros) {
  return { calories: target.calories - t.calories, protein: target.protein - t.protein, carbs: target.carbs - t.carbs, fat: target.fat - t.fat };
}

export interface DayRow { date: ISODate; totals: Macros; logged: boolean; phase?: NutritionPhase }
/** Averages use only days with food logged, so an unlogged day is not counted as zero intake. */
export function weekSummary(foods: FoodEntry[], phases: NutritionPhase[], anyDateInWeek: ISODate) {
  const start = startOfWeekMonday(anyDateInWeek);
  const days: DayRow[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i); const f = foods.filter(x => x.date === date);
    return { date, totals: sumFoods(f), logged: f.length > 0, phase: phaseForDate(phases, date) };
  });
  const logged = days.filter(d => d.logged);
  const n = Math.max(1, logged.length);
  const avg = logged.reduce((t, d) => ({ calories: t.calories + d.totals.calories / n, protein: t.protein + d.totals.protein / n, carbs: t.carbs + d.totals.carbs / n, fat: t.fat + d.totals.fat / n, fibre: t.fibre + d.totals.fibre / n }), { ...ZERO });
  const proteinHitDays = logged.filter(d => d.phase && d.totals.protein >= d.phase.protein * 0.9).length;
  return { start, days, loggedDays: logged.length, avg, proteinHitDays };
}

/** Trailing moving average over a calendar window (not a fixed count of entries), so gaps do not distort it. */
export function movingAverage(entries: BodyweightEntry[], windowDays = 7): { date: ISODate; weight: number; avg: number }[] {
  const s = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return s.map(e => {
    const w = s.filter(x => diffDays(e.date, x.date) >= 0 && diffDays(e.date, x.date) < windowDays);
    return { date: e.date, weight: e.weight, avg: w.reduce((t, x) => t + x.weight, 0) / w.length };
  });
}

/** Least-squares trend in weight units per week over the last `days` days. Null when there is too little data. */
export function weeklyRate(entries: BodyweightEntry[], days = 28): number | null {
  const s = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length === 0) return null;
  const last = s[s.length - 1].date;
  const w = s.filter(e => diffDays(last, e.date) <= days);
  if (w.length < 3 || diffDays(w[w.length - 1].date, w[0].date) < 6) return null;
  const xs = w.map(e => diffDays(e.date, w[0].date)), ys = w.map(e => e.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const den = xs.reduce((t, x) => t + (x - mx) ** 2, 0);
  return den === 0 ? null : (xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0) / den) * 7;
}
