import type { ExperienceLevel, Progression } from '../types/index.ts';
import type { Readiness } from './readiness.ts';

export interface PrevSet { weight: number; reps: number; rir?: number }
export interface PrevSession { date: string; sets: PrevSet[] }
export interface Ctx {
  progression: Progression; level: ExperienceLevel; prescribed: { sets: number; repMin: number; repMax: number; rir: number };
  sessions: PrevSession[]; // newest first, working sets only
  readiness: Readiness;
  lastFeedback?: { difficulty: 'easy' | 'appropriate' | 'hard'; fatigue: number; performance: 'below' | 'met' | 'exceeded'; soreness?: number; workload?: number };
  muscleVolumePlan?: { extraSets: number; reasons: string[] };
  weekIndex: number; totalWeeks: number; step?: number;
}
export type Action = 'start' | 'manual' | 'increase_load' | 'add_reps' | 'maintain' | 'hold_caution';
export interface Target { weight: number | null; repMin: number; repMax: number }
export interface Rec {
  action: Action; sets: number; setsChange: 'none' | 'increase' | 'held' | 'deload'; targets: Target[];
  summary: string; reasons: string[]; research: string[]; heuristics: string[]; flags: string[]; stepHint?: number;
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const fmt = (s: PrevSet[]) => s.map(x => `${x.weight}×${x.reps}`).join(', ');
const maxW = (s: PrevSet[]) => Math.max(...s.map(x => x.weight));

export function recommend(c: Ctx): Rec {
  const { prescribed: p, sessions, readiness: r, progression: prog } = c;
  const base: Rec = { action: 'start', sets: p.sets, setsChange: 'none', targets: [], summary: '', reasons: [], research: [], heuristics: [], flags: [], stepHint: c.step };
  const last = sessions[0]?.sets;
  const per = (n: number, f: (s: PrevSet) => Target): Target[] => Array.from({ length: n }, (_, i) => f(last![Math.min(i, last!.length - 1)]));

  if (r.level === 'caution') {
    return { ...base, action: 'hold_caution', flags: ['safety'], targets: Array.from({ length: p.sets }, () => ({ weight: last?.[0]?.weight ?? null, repMin: p.repMin, repMax: p.repMax })), summary: 'Skip progression today. Consider a lighter session, a different exercise, or rest.',
      reasons: [`You reported ${r.cautions.join(' and ')}.`, 'Avoid training through concerning pain. This app cannot diagnose injuries; if it is persistent or sharp, get it checked by a qualified professional.'] };
  }

  if (!last || last.length === 0) {
    const volume = (prog.strategy === 'volume' || prog.strategy === 'hybrid') ? prog.volume : undefined;
    const deload = !!volume?.deloadLastWeek && c.totalWeeks > 1 && c.weekIndex === c.totalWeeks - 1;
    const canAdd = r.level !== 'low';
    const plannedExtra = canAdd && volume && !deload ? Math.min(Math.max(0, c.weekIndex * volume.weeklySetChange), volume.maxExtraSets) : 0;
    const muscleExtra = c.muscleVolumePlan && prog.strategy !== 'manual' && canAdd && !deload ? Math.max(0, c.muscleVolumePlan.extraSets) : 0;
    const sets = deload ? Math.max(1, Math.round(p.sets / 2)) : p.sets + plannedExtra + muscleExtra;
    return { ...base, sets, setsChange: deload ? 'deload' : plannedExtra + muscleExtra > 0 ? 'increase' : 'none', summary: `No history yet. Choose a load that leaves about ${p.rir} reps in reserve.`, reasons: ['There is no earlier record of this exercise.', ...(plannedExtra > 0 ? [`Volume plan: +${plannedExtra} set${plannedExtra === 1 ? '' : 's'} this week.`] : []), ...(muscleExtra > 0 ? c.muscleVolumePlan?.reasons ?? [] : []), ...(deload ? [`Deload week: sets reduced from ${p.sets} to ${sets}.`] : [])], research: ['rir-range', 'rir-accuracy', ...(plannedExtra + muscleExtra > 0 ? ['volume-landmarks', 'volume-dose'] : [])], heuristics: ['No-history recommendations use the prescribed rep range and conservative volume increases.'], targets: Array.from({ length: sets }, () => ({ weight: null, repMin: p.repMin, repMax: p.repMax })) };
  }
  const same = (s: PrevSet): Target => ({ weight: s.weight, repMin: Math.min(s.reps, p.repMax), repMax: Math.min(s.reps, p.repMax) });
  if (prog.strategy === 'manual') return { ...base, action: 'manual', summary: 'Manual progression: no automatic change suggested.', reasons: [`Last time: ${fmt(last)}.`], targets: per(p.sets, same), heuristics: ['You chose to control progression yourself.'] };

  const top = last.every(s => s.reps >= p.repMax);
  // Missing RIR is unknown, not proof that the set was within the target.
  const rirKnown = last.every(s => s.rir !== undefined);
  const rirOk = rirKnown && last.every(s => (s.rir as number) >= p.rir - 1);
  const rirs = last.filter(s => s.rir !== undefined).map(s => s.rir as number);
  const harder = rirs.some(rir => rir < p.rir - 1);
  const belowMin = last.some(s => s.reps < p.repMin);
  const drop = (a?: PrevSession, b?: PrevSession) => !!a && !!b && maxW(a.sets) === maxW(b.sets) && avg(a.sets.map(s => s.reps)) <= avg(b.sets.map(s => s.reps)) - 1;
  const declined = drop(sessions[0], sessions[1]);
  const consistent = declined && drop(sessions[1], sessions[2]);
  const fb = c.lastFeedback;
  const fbBad = !!fb && (fb.difficulty === 'hard' || fb.fatigue >= 4 || fb.performance === 'below' || (fb.soreness ?? 0) >= 5 || (fb.workload ?? 0) >= 5);
  const fbEasy = !!fb && !fbBad && fb.difficulty === 'easy' && fb.performance !== 'below' && fb.fatigue <= 2;

  const hold: string[] = [];
  if (r.level === 'low') hold.push(`Readiness is lower than usual today (${r.negatives.join(', ')}).`);
  if (fbBad) hold.push('Your last post-workout feedback said the session was hard, very fatiguing, very sore, or below expectations.');
  if (belowMin) hold.push(`Last time at least one set fell below your ${p.repMin}-rep minimum.`);
  else if (declined) hold.push('Reps dropped compared with the session before, at the same load.');
  if (harder) hold.push(`At least one working set was harder than prescribed (RIR below ${p.rir - 1}).`);
  if (top && !rirKnown && prog.strategy !== 'rep') hold.push('RIR was not recorded for every working set, so load progression is not confirmed. Record RIR before increasing the load.');
  const flags: string[] = consistent ? ['consistent-underperformance'] : [];
  const notes: string[] = r.level === 'moderate' ? [`Minor recovery flags (${r.negatives.join(', ')}); not enough on their own to change the plan.`] : r.level === 'unknown' ? ['No check-in today, so readiness was not considered.'] : [];

  let action: Action; let summary: string; let reasons: string[]; let heuristics: string[]; let research: string[]; let targets: Target[];
  if (hold.length) {
    action = 'maintain'; summary = 'Keep the previous load and reps for now rather than progressing.'; reasons = [`Last time: ${fmt(last)}.`, ...hold, ...notes];
    heuristics = ['Hold the load when readiness or recent performance is down; a single poor factor alone does not trigger this.'];
    research = ['fatigue-mgmt'];
    if (consistent) reasons.push('Performance has fallen over three sessions. Options: take an easier session or deload, review sleep and food, check technique, or swap the exercise. Adding volume is not the automatic answer.');
    targets = per(p.sets, same);
  } else if ((top && rirOk && prog.strategy !== 'rep') || (prog.strategy === 'load' && last.every(s => s.reps >= p.repMin) && rirOk)) {
    action = 'increase_load'; summary = 'Increase the weight a little.';
    reasons = [top ? `You reached the top of your rep range (${p.repMax}) on every working set last time (${fmt(last)}).` : `You hit your rep minimum on every set last time (${fmt(last)}) and your strategy prioritises load.`, 'RIR stayed on target.', ...(r.level === 'good' ? ['You reported good readiness.'] : notes)];
    heuristics = ['Raise the load once the top of the range is reached on all sets at the prescribed RIR, then work back up the range.'];
    research = ['overload'];
    targets = Array.from({ length: p.sets }, (_, i) => ({ weight: c.step !== undefined && Number.isFinite(c.step) && c.step > 0 ? Math.round((last[Math.min(i, last.length - 1)].weight + c.step) * 100) / 100 : null, repMin: p.repMin, repMax: Math.min(p.repMin + 1, p.repMax) }));
  } else if (top && prog.strategy === 'rep') {
    action = 'maintain'; summary = 'Hold the load and reps. Your strategy prioritises reps.';
    reasons = [`You are at the top of your rep range (${fmt(last)}).`, 'To progress further, widen the rep range in the template or switch the mesocycle strategy.'];
    heuristics = ['Rep progression keeps the load fixed and adds reps within the range.']; research = ['overload']; targets = per(p.sets, same);
  } else {
    const stepUp = fbEasy ? 2 : 1;
    action = 'add_reps'; summary = 'Keep the same weight and add a rep where you can.';
    reasons = [`Last time: ${fmt(last)}. There is still room in your ${p.repMin}–${p.repMax} range.`, ...(fbEasy ? ['You rated the last session as easy, so the rep target is a little more ambitious.'] : []), ...notes];
    heuristics = ['Add reps before adding load (double progression).']; research = ['overload'];
    targets = per(p.sets, s => ({ weight: s.weight, repMin: Math.min(s.reps, p.repMax), repMax: Math.min(s.reps + stepUp, p.repMax) }));
  }

  let sets = p.sets; let setsChange: Rec['setsChange'] = 'none';
  const volumeStrategy = (prog.strategy === 'volume' || prog.strategy === 'hybrid') && prog.volume;
  const deload = !!volumeStrategy && volumeStrategy.deloadLastWeek && c.totalWeeks > 1 && c.weekIndex === c.totalWeeks - 1;
  if (deload) {
    sets = Math.max(1, Math.round(p.sets / 2)); setsChange = 'deload';
    reasons.push(`Deload week: sets reduced from ${p.sets} to ${sets}.`);
  } else {
    const plannedExtra = volumeStrategy ? Math.min(Math.max(0, c.weekIndex * volumeStrategy.weeklySetChange), volumeStrategy.maxExtraSets) : 0;
    const allowedPlannedExtra = hold.length ? 0 : plannedExtra;
    const muscleExtra = hold.length ? 0 : Math.max(0, c.muscleVolumePlan?.extraSets ?? 0);
    sets = p.sets + allowedPlannedExtra + muscleExtra;
    if (plannedExtra > 0) {
      if (hold.length) { setsChange = 'held'; reasons.push(`Planned volume increase of ${plannedExtra} set${plannedExtra === 1 ? '' : 's'} held because recovery or performance does not support it.`); }
      else reasons.push(`Volume plan: +${plannedExtra} set${plannedExtra === 1 ? '' : 's'} this week (prescribed ${p.sets}).`);
    }
    if (muscleExtra > 0) {
      reasons.push(...(c.muscleVolumePlan?.reasons ?? []));
      heuristics.push('Muscle-specific volume is allocated only where projected weekly work is below the preferred minimum, while respecting configured maximums.');
      research.push('volume-landmarks', 'volume-dose');
    } else if (c.muscleVolumePlan?.reasons.length) reasons.push(...c.muscleVolumePlan.reasons);
    if (plannedExtra > 0 && !hold.length || muscleExtra > 0) setsChange = 'increase';
  }
  if (volumeStrategy) {
    heuristics.push('Volume changes follow the mesocycle plan and are gated by recovery and performance.');
    research.push('volume-landmarks', 'volume-dose');
  }
  if (targets.length !== sets) targets = Array.from({ length: sets }, (_, i) => targets[Math.min(i, targets.length - 1)]);
  return { ...base, action, sets, setsChange, targets, summary, reasons, research: [...new Set(research)], heuristics, flags };
}
