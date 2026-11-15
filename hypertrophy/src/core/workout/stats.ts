import type { CompletedExercise, CompletedSet, CompletedWorkout, DraftSet, WorkoutDraft, WeightUnit } from '../types/index.ts';

/** Epley estimate; only an estimate, most reliable at low reps. */
export const epley = (w: number, r: number): number => (r <= 1 ? w : w * (1 + r / 30));
export const isWorking = (s: CompletedSet): boolean => s.kind !== 'warmup';

export function summarize(w: CompletedWorkout) {
  let sets = 0, reps = 0, volume = 0;
  for (const e of w.exercises) for (const s of e.sets) if (isWorking(s)) { sets++; reps += s.reps; volume += s.weight * s.reps; }
  return { exercises: w.exercises.length, sets, reps, volume };
}

/** Working sets from the most recent finished workout that included this exercise. */
export function previousSets(history: CompletedWorkout[], exerciseId: string): { date: string; sets: CompletedSet[] } | null {
  const sorted = [...history].sort((a, b) => b.finishedAt - a.finishedAt);
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    const sets = ex?.sets.filter(isWorking) ?? [];
    if (sets.length) return { date: w.date, sets };
  }
  return null;
}

export interface PR { exerciseName: string; type: 'weight' | 'e1rm'; value: number }
/** A PR needs earlier history for that exercise; a first-ever performance is not flagged. */
export function findPRs(history: CompletedWorkout[], w: CompletedWorkout): PR[] {
  const prs: PR[] = [];
  for (const e of w.exercises) {
    const prior = history.filter(h => h.id !== w.id).flatMap(h => h.exercises.filter(x => x.exerciseId === e.exerciseId)).flatMap((x: CompletedExercise) => x.sets.filter(isWorking));
    if (prior.length === 0) continue;
    const now = e.sets.filter(isWorking);
    const bestW = Math.max(...prior.map(s => s.weight)), bestE = Math.max(...prior.map(s => epley(s.weight, s.reps)));
    const nowW = Math.max(0, ...now.map(s => s.weight)), nowE = Math.max(0, ...now.map(s => epley(s.weight, s.reps)));
    if (nowW > bestW) prs.push({ exerciseName: e.exerciseName, type: 'weight', value: nowW });
    if (nowE > bestE + 1e-9) prs.push({ exerciseName: e.exerciseName, type: 'e1rm', value: Math.round(nowE * 10) / 10 });
  }
  return prs;
}

export function isSetValid(s: DraftSet): boolean {
  const w = Number(s.weight), r = Number(s.reps);
  return s.weight.trim() !== '' && s.reps.trim() !== '' && Number.isFinite(w) && w >= 0 && Number.isInteger(r) && r > 0 && (s.rir.trim() === '' || (Number.isFinite(Number(s.rir)) && Number(s.rir) >= 0));
}

/** Convert a draft to an immutable record: only sets the user explicitly marked done are kept. */
export function toCompleted(d: WorkoutDraft, id: string, finishedAt: number, unit: WeightUnit): CompletedWorkout {
  return {
    id, scheduledId: d.scheduledId, mesocycleId: d.mesocycleId, templateId: d.templateId, templateName: d.templateName, date: d.date,
    startedAt: d.startedAt, finishedAt, unit, checkinId: d.checkin?.id,
    exercises: d.exercises.map(e => ({
      id: e.id, exerciseId: e.exerciseId, exerciseName: e.name, prescribed: { ...e.prescribed }, notes: e.notes,
      sets: e.list.filter(s => s.done && isSetValid(s)).map(s => ({ id: s.id, kind: s.kind, weight: Number(s.weight), reps: Number(s.reps), rir: s.rir.trim() === '' ? undefined : Number(s.rir) }))
    })).filter(e => e.sets.length > 0)
  };
}
