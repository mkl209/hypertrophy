import { addDays, diffDays, weekIndex } from '../calendar/dates.ts';
import type { Mesocycle, ScheduledWorkout } from '../types/index.ts';

/**
 * Resume a paused block. Remaining sessions shift later by whole weeks (so weekdays stay aligned), the block gains those weeks,
 * and the paused weeks appear as empty columns. Completed, missed and skipped sessions are never touched.
 */
export function applyPause(meso: Mesocycle, scheduled: ScheduledWorkout[], pausedOn: string, resumeOn: string) {
  if (resumeOn <= pausedOn) throw new Error('The resume date must be after the pause date.');
  const k = weekIndex(meso.startDate, pausedOn);
  if (k < 0 || k >= meso.weeks) throw new Error('The pause date is outside this block.');
  const weeks = Math.ceil(diffDays(resumeOn, pausedOn) / 7);
  const days = weeks * 7;
  const moved = scheduled.map(s => s.mesocycleId === meso.id && s.status === 'scheduled' && s.date >= pausedOn && s.weekIndex >= k
    ? { ...s, date: addDays(s.date, days), originalDate: addDays(s.originalDate, days), weekIndex: s.weekIndex + weeks } : s);
  const sequence = [...meso.sequence];
  sequence.splice(k + 1, 0, ...Array<string>(weeks - 1).fill(''), sequence[k]); // '' marks a paused week
  return { meso: { ...meso, weeks: meso.weeks + weeks, sequence, pausedOn: undefined, pauses: [...(meso.pauses ?? []), { from: pausedOn, to: resumeOn, weeks }] }, scheduled: moved };
}
