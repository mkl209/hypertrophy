import { addDays, diffDays, startOfWeekMonday, weekIndex, type ISODate } from '../calendar/dates.ts';
import { epley, isWorking, summarize } from '../workout/stats.ts';
import { phaseForDate, weeklyRate, sumFoods } from '../nutrition/nutrition.ts';
import type { CompletedWorkout, FoodEntry, Mesocycle, NutritionPhase, PostWorkoutFeedback, PreWorkoutCheckIn, ScheduledWorkout, BodyweightEntry } from '../types/index.ts';

export interface Range { from: ISODate; to: ISODate }
export const inRange = (d: ISODate, r: Range): boolean => d >= r.from && d <= r.to;
export const mesoEnd = (m: Mesocycle): ISODate => addDays(startOfWeekMonday(m.startDate), m.weeks * 7 - 1);

export function workoutTotals(ws: CompletedWorkout[]) {
  return ws.reduce((t, w) => { const s = summarize(w); return { sessions: t.sessions + 1, sets: t.sets + s.sets, reps: t.reps + s.reps, volume: t.volume + s.volume }; }, { sessions: 0, sets: 0, reps: 0, volume: 0 });
}
export function weeklyTotals(ws: CompletedWorkout[]): { week: ISODate; sessions: number; sets: number; volume: number }[] {
  const m = new Map<ISODate, { week: ISODate; sessions: number; sets: number; volume: number }>();
  for (const w of ws) { const k = startOfWeekMonday(w.date); const s = summarize(w); const r = m.get(k) ?? { week: k, sessions: 0, sets: 0, volume: 0 }; r.sessions++; r.sets += s.sets; r.volume += s.volume; m.set(k, r); }
  return [...m.values()].sort((a, b) => a.week.localeCompare(b.week));
}

// ---- muscle volume: indirect work is a configurable estimate, not an exact physiological measure ----
export interface ExMuscles { primary: string[]; secondary: string[] }
export interface MuscleRow { muscleId: string; direct: number; indirect: number; weighted: number; sessions: number }
export function muscleVolume(ws: CompletedWorkout[], ex: Map<string, ExMuscles>, secondaryWeight: number): MuscleRow[] {
  const rows = new Map<string, { direct: number; indirect: number; days: Set<string> }>();
  const get = (id: string) => { let r = rows.get(id); if (!r) { r = { direct: 0, indirect: 0, days: new Set() }; rows.set(id, r); } return r; };
  for (const w of ws) for (const e of w.exercises) {
    const m = ex.get(e.exerciseId); if (!m) continue;
    const n = e.sets.filter(isWorking).length; if (n === 0) continue;
    for (const p of m.primary) { const r = get(p); r.direct += n; r.days.add(w.id); }
    for (const s of m.secondary) if (!m.primary.includes(s)) get(s).indirect += n;
  }
  return [...rows.entries()].map(([muscleId, r]) => ({ muscleId, direct: r.direct, indirect: r.indirect, weighted: r.direct + secondaryWeight * r.indirect, sessions: r.days.size }));
}
export function weeklyMuscleSets(ws: CompletedWorkout[], ex: Map<string, ExMuscles>, secondaryWeight: number, muscleId: string) {
  const byWeek = new Map<ISODate, CompletedWorkout[]>();
  for (const w of ws) { const k = startOfWeekMonday(w.date); byWeek.set(k, [...(byWeek.get(k) ?? []), w]); }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, list]) => {
    const r = muscleVolume(list, ex, secondaryWeight).find(x => x.muscleId === muscleId);
    return { week, direct: r?.direct ?? 0, weighted: r?.weighted ?? 0 };
  });
}

// ---- exercise history ----
export interface ExSession { date: ISODate; workoutId: string; topWeight: number; bestE1rm: number; sets: number; reps: number; volume: number; avgRir: number | null; prWeight: boolean; prE1rm: boolean }
export function exerciseSessions(ws: CompletedWorkout[], exerciseId: string): ExSession[] {
  const out: ExSession[] = []; let bestW = -1, bestE = -1;
  for (const w of [...ws].sort((a, b) => a.finishedAt - b.finishedAt)) {
    const sets = w.exercises.filter(e => e.exerciseId === exerciseId).flatMap(e => e.sets.filter(isWorking));
    if (!sets.length) continue;
    const topWeight = Math.max(...sets.map(s => s.weight)), bestE1rm = Math.max(...sets.map(s => epley(s.weight, s.reps)));
    const rirs = sets.filter(s => s.rir !== undefined).map(s => s.rir as number);
    out.push({ date: w.date, workoutId: w.id, topWeight, bestE1rm: Math.round(bestE1rm * 10) / 10, sets: sets.length, reps: sets.reduce((t, s) => t + s.reps, 0), volume: sets.reduce((t, s) => t + s.weight * s.reps, 0),
      avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null, prWeight: bestW >= 0 && topWeight > bestW, prE1rm: bestE >= 0 && bestE1rm > bestE + 1e-9 });
    bestW = Math.max(bestW, topWeight); bestE = Math.max(bestE, bestE1rm);
  }
  return out;
}

// ---- mesocycle ----
const avg = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export function mesoSummary(meso: Mesocycle, scheduled: ScheduledWorkout[], completed: CompletedWorkout[], checkins: PreWorkoutCheckIn[], feedback: PostWorkoutFeedback[], today: ISODate) {
  const mine = completed.filter(w => w.mesocycleId === meso.id);
  const sched = scheduled.filter(s => s.mesocycleId === meso.id);
  const due = sched.filter(s => s.date <= today);
  const done = due.filter(s => s.status === 'completed').length;
  const missed = due.filter(s => s.status === 'missed' || (s.status === 'scheduled' && s.date < today)).length;
  const skipped = due.filter(s => s.status === 'skipped').length;
  const weeks = Array.from({ length: meso.weeks }, (_, w) => {
    const wk = mine.filter(x => weekIndex(meso.startDate, x.date) === w);
    const sets = wk.flatMap(x => x.exercises.flatMap(e => e.sets.filter(isWorking)));
    const rirs = sets.filter(s => s.rir !== undefined).map(s => s.rir as number);
    const start = addDays(startOfWeekMonday(meso.startDate), w * 7), end = addDays(start, 6);
    const fb = feedback.filter(f => wk.some(x => x.id === f.workoutId));
    return { week: w, sessions: wk.length, sets: sets.length, volume: sets.reduce((t, s) => t + s.weight * s.reps, 0), avgRir: avg(rirs),
      avgReadiness: avg(checkins.filter(c => c.date >= start && c.date <= end).map(c => c.readiness)), avgFatigueFeedback: avg(fb.map(f => f.fatigue)) };
  });
  return { planned: sched.length, due: due.length, completed: done, missed, skipped, completionRate: due.length ? done / due.length : null, weeks, totals: workoutTotals(mine), workouts: mine };
}

// ---- recovery vs performance (correlation only) ----
export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 8) return null;
  const mx = avg(xs) as number, my = avg(ys) as number;
  const sxy = xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0), sxx = xs.reduce((t, x) => t + (x - mx) ** 2, 0), syy = ys.reduce((t, y) => t + (y - my) ** 2, 0);
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}
/** Volume change vs the previous session of the same template, paired with that day's self-rated readiness. */
export function readinessVsPerformance(ws: CompletedWorkout[], checkins: PreWorkoutCheckIn[]) {
  const byId = new Map(checkins.map(c => [c.id, c]));
  const sorted = [...ws].sort((a, b) => a.finishedAt - b.finishedAt);
  const pairs: { date: ISODate; template: string; readiness: number; change: number }[] = [];
  sorted.forEach((w, i) => {
    const c = w.checkinId ? byId.get(w.checkinId) : undefined; if (!c) return;
    const prev = [...sorted.slice(0, i)].reverse().find(p => p.templateId && p.templateId === w.templateId); if (!prev) return;
    const pv = summarize(prev).volume; if (pv <= 0) return;
    pairs.push({ date: w.date, template: w.templateName, readiness: c.readiness, change: ((summarize(w).volume - pv) / pv) * 100 });
  });
  return { pairs, r: pearson(pairs.map(p => p.readiness), pairs.map(p => p.change)) };
}

// ---- nutrition phases ----
export function phaseSummary(phase: NutritionPhase, foods: FoodEntry[], weights: BodyweightEntry[], today: ISODate) {
  const to = phase.endDate && phase.endDate < today ? phase.endDate : today;
  const f = foods.filter(x => x.date >= phase.startDate && x.date <= to);
  const days = new Set(f.map(x => x.date)); const t = sumFoods(f); const n = Math.max(1, days.size);
  const w = weights.filter(x => x.date >= phase.startDate && x.date <= to);
  return { loggedDays: days.size, span: Math.max(0, diffDays(to, phase.startDate) + 1), avgKcal: days.size ? t.calories / n : null, avgProtein: days.size ? t.protein / n : null, rate: weeklyRate(w, 100000), phase: phaseForDate([phase], phase.startDate) };
}
