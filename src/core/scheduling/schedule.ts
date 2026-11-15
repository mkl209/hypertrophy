import { addDays, diffDays, startOfWeekMonday } from '../calendar/dates.ts';
import type { Mesocycle, Microcycle, ScheduledWorkout, SequencePattern } from '../types/index.ts';

/** Which microcycle runs in each week. */
export function buildSequence(pattern: SequencePattern, microIds: string[], weeks: number): string[] {
  if (!Number.isInteger(weeks) || weeks < 1) throw new Error('Weeks must be a positive whole number');
  if (microIds.length === 0) throw new Error('Choose at least one week structure');
  if (pattern === 'custom') {
    if (microIds.length !== weeks) throw new Error('Custom sequence needs one entry per week');
    return [...microIds];
  }
  if (pattern === 'repeat') return Array.from({ length: weeks }, () => microIds[0]);
  return Array.from({ length: weeks }, (_, i) => microIds[i % microIds.length]); // alternate / rotate
}

/** Deterministically generate every scheduled workout from the start date and week sequence. Weeks run Monday–Sunday; dates before the start date are skipped. */
export function generateSchedule(meso: Mesocycle, micros: Microcycle[]): ScheduledWorkout[] {
  const byId = new Map(micros.map(m => [m.id, m]));
  const firstMonday = startOfWeekMonday(meso.startDate);
  const out: ScheduledWorkout[] = [];
  for (let w = 0; w < meso.weeks; w++) {
    const micro = byId.get(meso.sequence[w]);
    if (!micro) throw new Error(`Week structure missing for week ${w + 1}`);
    const counts = new Map<string, number>();
    for (const d of [...micro.days].sort((a, b) => a.weekday - b.weekday)) {
      const date = addDays(firstMonday, w * 7 + d.weekday);
      if (diffDays(date, meso.startDate) < 0) continue;
      const n = counts.get(date) ?? 0; counts.set(date, n + 1);
      out.push({ id: `${meso.id}_${date}_${n}`, mesocycleId: meso.id, weekIndex: w, date, originalDate: date, templateId: d.templateId, status: 'scheduled' });
    }
  }
  return out;
}
