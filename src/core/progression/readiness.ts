import type { PreWorkoutCheckIn } from '../types/index.ts';

export type ReadinessLevel = 'unknown' | 'good' | 'moderate' | 'low' | 'caution';
export interface Readiness { level: ReadinessLevel; negatives: string[]; cautions: string[] }

/** Yesterday's flags count this much compared with today's (1 each). */
export const YESTERDAY_WEIGHT = 0.5;

/** Latest check-in for a date (several can exist if the user re-submitted). */
export const latestFor = (list: PreWorkoutCheckIn[], date: string): PreWorkoutCheckIn | undefined =>
  list.filter(c => c.date === date).sort((a, b) => b.createdAt - a.createdAt)[0];

function todayFlags(c: PreWorkoutCheckIn): string[] {
  const n: string[] = [];
  if (c.sleepHours < 6) n.push('short sleep');
  if (c.sleepQuality <= 2) n.push('poor sleep quality');
  if (c.fatigue >= 4) n.push('high fatigue');
  if (c.soreness >= 4) n.push('high soreness');
  if (c.recovery <= 2) n.push('poor recovery');
  if (c.stress >= 4) n.push('high stress');
  if (c.mentalFatigue >= 4) n.push('high mental fatigue');
  if (c.motivation <= 2) n.push('low motivation');
  if (c.readiness <= 2) n.push('low self-rated readiness');
  if (c.jointDiscomfort >= 4) n.push('joint discomfort');
  return n;
}

/** Only things that plausibly linger into the next day. Mood-type items do not carry over. */
function carryFlags(c: PreWorkoutCheckIn): string[] {
  const n: string[] = [];
  if (c.sleepHours < 6) n.push('short sleep');
  if (c.sleepQuality <= 2) n.push('poor sleep quality');
  if (c.fatigue >= 4) n.push('high fatigue');
  if (c.soreness >= 4) n.push('high soreness');
  if (c.recovery <= 2) n.push('poor recovery');
  if (c.stress >= 4) n.push('high stress');
  if (c.mentalFatigue >= 4) n.push('high mental fatigue');
  if (c.jointPain >= 3) n.push('joint pain');
  if (c.unwell) n.push('illness');
  return n;
}

/**
 * One poor factor is not enough to change anything: score 1+ = moderate, 3+ = low.
 * Today's flags score 1 each; yesterday's score YESTERDAY_WEIGHT each.
 * Joint pain or illness TODAY = caution. Without a check-in today, yesterday alone caps at moderate.
 */
export function assessReadiness(c?: PreWorkoutCheckIn, yesterday?: PreWorkoutCheckIn): Readiness {
  if (!c && !yesterday) return { level: 'unknown', negatives: [], cautions: [] };
  const cautions: string[] = [];
  if (c && c.jointPain >= 3) cautions.push('joint pain');
  if (c?.unwell) cautions.push('feeling unwell');
  const today = c ? todayFlags(c) : [];
  const carry = yesterday ? carryFlags(yesterday).map(f => `${f} yesterday`) : [];
  const score = today.length + carry.length * YESTERDAY_WEIGHT;
  let level: ReadinessLevel = cautions.length ? 'caution' : score >= 3 ? 'low' : score >= 1 ? 'moderate' : 'good';
  if (!c) level = level === 'low' ? 'moderate' : level === 'good' ? 'unknown' : level;
  return { level, negatives: [...today, ...carry], cautions };
}
