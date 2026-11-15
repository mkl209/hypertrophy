import type { PreWorkoutCheckIn } from '../types/index.ts';

export type ReadinessLevel = 'unknown' | 'good' | 'moderate' | 'low' | 'caution';
export interface Readiness { level: ReadinessLevel; negatives: string[]; cautions: string[] }

/** One poor factor is not enough to change anything: 1–2 flags = moderate, 3+ = low. Joint pain or illness = caution. */
export function assessReadiness(c?: PreWorkoutCheckIn): Readiness {
  if (!c) return { level: 'unknown', negatives: [], cautions: [] };
  const cautions: string[] = [];
  if (c.jointPain >= 3) cautions.push('joint pain');
  if (c.unwell) cautions.push('feeling unwell');
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
  const level: ReadinessLevel = cautions.length ? 'caution' : n.length >= 3 ? 'low' : n.length >= 1 ? 'moderate' : 'good';
  return { level, negatives: n, cautions };
}
