import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, diffDays, startOfWeekMonday, weekIndex } from '../../core/calendar/dates.ts';
import { recommend, type PrevSession, type Rec } from '../../core/progression/engine.ts';
import { effectiveRir, isWorking } from '../../core/workout/stats.ts';
import { allocateMuscleVolume } from '../../core/progression/muscleVolume.ts';
import { assessReadiness, latestFor } from '../../core/progression/readiness.ts';
import { FINDING_BY_ID } from '../../research/findings.ts';
import type { CompletedWorkout, Exercise, ExperienceLevel, PostWorkoutFeedback, Strategy, UserSettings, WorkoutDraft } from '../../core/types/index.ts';

function sessionsFor(history: CompletedWorkout[], exerciseId: string): PrevSession[] {
  return [...history].sort((a, b) => b.finishedAt - a.finishedAt).flatMap(w => {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    const sets = (ex?.sets ?? []).filter(s => s.kind !== 'warmup').map(s => ({ weight: s.weight, reps: s.reps, rir: effectiveRir(s) }));
    return sets.length ? [{ date: w.date, sets }] : [];
  }).slice(0, 3);
}

/** Feedback from the last workout that included this exercise; ignored once it is more than 10 days old. */
function feedbackFor(history: CompletedWorkout[], all: PostWorkoutFeedback[], exerciseId: string, date: string): PostWorkoutFeedback | undefined {
  const w = [...history].sort((a, b) => b.finishedAt - a.finishedAt).find(x => x.exercises.some(e => e.exerciseId === exerciseId));
  if (!w || diffDays(date, w.date) > 10) return undefined;
  return all.filter(f => f.workoutId === w.id).sort((a, b) => b.createdAt - a.createdAt)[0];
}

const rng = (t: { weight: number | null; repMin: number; repMax: number }, unit: string) =>
  `${t.weight === null ? 'heavier' : `${t.weight} ${unit}`} × ${t.repMin === t.repMax ? t.repMin : `${t.repMin}–${t.repMax}`}`;

export default function Feed({ d, history, exercises, settings, level, enabled, defaultStrategy, unit, onApply, onStart, onBack }: {
  d: WorkoutDraft; history: CompletedWorkout[]; exercises: Exercise[]; settings: UserSettings; level: ExperienceLevel; enabled: boolean; defaultStrategy: Strategy; unit: string;
  onApply: (exId: string, rec: Rec) => void; onStart: () => void; onBack: () => void;
}) {
  const meso = useLiveQuery(() => (d.mesocycleId ? db.mesocycles.get(d.mesocycleId) : undefined), [d.mesocycleId]);
  const feedback = useLiveQuery(() => db.feedback.toArray(), []) ?? [];
  const weekStart = startOfWeekMonday(d.date);
  const weekEnd = addDays(weekStart, 6);
  const scheduledThisWeek = useLiveQuery(() => db.scheduled.where('date').between(weekStart, weekEnd, true, true).filter(w => w.status === 'scheduled' && w.date >= d.date && w.id !== d.scheduledId).toArray(), [weekStart, weekEnd, d.date, d.scheduledId]) ?? [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const allExercises = useLiveQuery(() => db.exercises.toArray(), []) ?? exercises;
  const ydate = addDays(d.checkin?.date ?? d.date, -1);
  const yRows = useLiveQuery(() => db.checkins.where('date').equals(ydate).toArray(), [ydate]);
  const yesterday = yRows ? latestFor(yRows, ydate) : undefined;
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const readiness = assessReadiness(d.checkin, yesterday);
  const prog = meso?.progression ?? { strategy: defaultStrategy };
  const musclePreferences = settings.muscleVolumePreferences ?? {};
  const hasMusclePreferences = Object.values(musclePreferences).some(p => p.min !== undefined || p.max !== undefined);
  const projectedBase: Record<string, number> = {};
  const exerciseById = new Map(allExercises.map(x => [x.id, x]));
  const addExerciseVolume = (exerciseId: string, sets: number) => {
    const ex = exerciseById.get(exerciseId); if (!ex || sets <= 0) return;
    for (const id of ex.primaryMuscles) projectedBase[id] = (projectedBase[id] ?? 0) + sets;
    for (const id of ex.secondaryMuscles) if (!ex.primaryMuscles.includes(id)) projectedBase[id] = (projectedBase[id] ?? 0) + sets * settings.secondaryMuscleWeight;
  };
  for (const w of history.filter(w => w.date >= weekStart && w.date <= weekEnd)) for (const e of w.exercises) addExerciseVolume(e.exerciseId, e.sets.filter(isWorking).length);
  for (const sw of scheduledThisWeek) { const template = templates.find(t => t.id === sw.templateId); for (const e of template?.exercises ?? []) addExerciseVolume(e.exerciseId, e.sets); }
  const wk = meso ? Math.max(0, weekIndex(meso.startDate, d.date)) : 0;
  const plannedVolumeExtra = (prog.strategy === 'volume' || prog.strategy === 'hybrid') && prog.volume && !(prog.volume.deloadLastWeek && meso && wk === meso.weeks - 1) ? Math.min(wk * prog.volume.weeklySetChange, prog.volume.maxExtraSets) : 0;
  const volumeExercises = d.exercises.map(e => { const ex = exerciseById.get(e.exerciseId); return { id: e.id, sets: e.prescribed.sets + plannedVolumeExtra, primaryMuscles: ex?.primaryMuscles ?? [], secondaryMuscles: ex?.secondaryMuscles ?? [] }; });
  const volumeAllocation = hasMusclePreferences ? allocateMuscleVolume(volumeExercises, projectedBase, musclePreferences, settings.secondaryMuscleWeight, prog.volume?.maxExtraSets ?? 2) : undefined;

  return (
    <div className="card">
      <h2>{d.templateName} · pre-workout feed</h2>
      {d.checkin || yesterday
        ? <p className="muted">Readiness {readiness.level}{readiness.negatives.length ? ` (${readiness.negatives.join(', ')})` : ''}{readiness.cautions.length ? ` · ${readiness.cautions.join(', ')}` : ''}.{!d.checkin ? ' No check-in today, so only yesterday’s counts, at reduced weight.' : ''}</p>
        : <p className="muted">No check-in, so readiness is not considered.</p>}
      {!enabled && <p className="muted">Recommendations are turned off in Settings. You can still see your last performance below.</p>}
      {d.exercises.map(e => {
        const sessions = sessionsFor(history, e.exerciseId);
        const fb = feedbackFor(history, feedback, e.exerciseId, d.date);
        const rec = recommend({
          progression: prog, level, prescribed: e.prescribed, sessions, readiness,
          lastFeedback: fb ? { difficulty: fb.difficulty, fatigue: fb.fatigue, performance: fb.performance, soreness: fb.soreness, workload: fb.workload } : undefined,
          muscleVolumePlan: volumeAllocation ? { extraSets: volumeAllocation.extraSets[e.id] ?? 0, reasons: volumeAllocation.reasons[e.id] ?? [] } : undefined,
          weekIndex: wk, totalWeeks: meso?.weeks ?? 0, step: exercises.find(x => x.id === e.exerciseId)?.defaults.increment
        });
        return (
          <div key={e.id} className="item col">
            <strong>{e.name}</strong>
            <span>{e.prescribed.sets} × {e.prescribed.repMin}–{e.prescribed.repMax} <span className="chip">RIR {e.prescribed.rir}</span></span>
            <span className="muted">Last time: {sessions[0] ? `${sessions[0].sets.map(s => `${s.weight}${unit}×${s.reps}`).join(', ')} (${sessions[0].date})` : 'none'}</span>
            {enabled && !hidden[e.id] && (
              <div className={`rec ${rec.flags.includes('safety') ? 'warn' : ''}`}>
                <strong>{rec.summary}</strong>
                <div>{rec.sets !== e.prescribed.sets ? `${rec.sets} sets (prescribed ${e.prescribed.sets}). ` : ''}{rec.targets.length > 0 && rec.action !== 'hold_caution' ? rec.targets.map(t => rng(t, unit)).join(' · ') : ''}</div>
                {rec.action === 'increase_load' && rec.stepHint !== undefined && <div className="muted sm2">Your usual step for this exercise is {rec.stepHint} {unit}; use whatever jump suits you.</div>}
                <details><summary>Why?</summary>
                  <ul>{rec.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  {rec.research.length > 0 && <div><strong>Research (your notes):</strong><ul>{rec.research.map(id => { const f = FINDING_BY_ID.get(id); return f ? <li key={id}>{f.text} <em>{f.source}, p. {f.page}.</em>{f.caveat ? ` Caveat: ${f.caveat}` : ''}</li> : null; })}</ul></div>}
                  {rec.heuristics.length > 0 && <div><strong>General heuristic (not research findings):</strong><ul>{rec.heuristics.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                  <div className="muted sm2">Your programme settings: {prog.strategy} progression.</div>
                </details>
                <div className="row" style={{ marginBottom: 0 }}>
                  {rec.action !== 'manual' && rec.action !== 'hold_caution' && <button className="btn sm" disabled={applied[e.id]} onClick={() => { onApply(e.id, rec); setApplied(a => ({ ...a, [e.id]: true })); }}>{applied[e.id] ? 'Applied' : 'Accept'}</button>}
                  <button className="btn ghost sm" onClick={() => setHidden(h => ({ ...h, [e.id]: true }))}>Ignore</button>
                </div>
              </div>)}
          </div>);
      })}
      {hasMusclePreferences && <p className="muted sm2">Muscle-specific volume uses this week's completed sets plus remaining scheduled sessions and this workout's prescribed sets. It adds sets only to address configured minimums, while treating configured maximums as hard guardrails and respecting recovery/performance checks.</p>}
      <p className="muted sm2">Accepting only pre-fills your logging screen. You can change anything while logging, and nothing in your programme is rewritten.</p>
      <div className="row"><button className="btn" onClick={onStart}>Start logging</button><button className="btn ghost" onClick={onBack}>Back</button></div>
    </div>
  );
}
