import type { ExperienceLevel, Progression, Strategy } from '../types/index.ts';

export const STRATEGY_LABEL: Record<Strategy, string> = {
  manual: 'Manual (no automatic suggestions)', double: 'Double progression (reps, then load)', rep: 'Rep progression (reps first, load held)',
  load: 'Load progression (load first)', volume: 'Volume progression (adds sets, intermediate/advanced)',
  hybrid: 'Hybrid progression (double + volume, intermediate/advanced)'
};
/** Beginners get simple overload only: volume periodisation is not selectable. */
export function allowedStrategies(level: ExperienceLevel): Strategy[] {
  return level === 'beginner' ? ['manual', 'double', 'rep', 'load'] : ['manual', 'double', 'rep', 'load', 'volume', 'hybrid'];
}
export function validateProgression(level: ExperienceLevel, p: Progression): string | null {
  if (!allowedStrategies(level).includes(p.strategy)) return 'Volume progression is not available at the beginner level.';
  if (p.strategy === 'volume' || p.strategy === 'hybrid') {
    const v = p.volume;
    if (!v || !Number.isInteger(v.weeklySetChange) || v.weeklySetChange < 0 || v.weeklySetChange > 2) return 'Weekly set change must be a whole number from 0 to 2.';
    if (!Number.isInteger(v.maxExtraSets) || v.maxExtraSets < 0 || v.maxExtraSets > 6) return 'Maximum extra sets must be a whole number from 0 to 6.';
  }
  return null;
}
export function describeProgression(p?: Progression): string {
  const s = p?.strategy ?? 'double';
  if ((s === 'volume' || s === 'hybrid') && p?.volume) {
    const detail = `+${p.volume.weeklySetChange} set per exercise each week (max +${p.volume.maxExtraSets})${p.volume.deloadLastWeek ? ', deload in the final week' : ''}. Only applied when recovery and performance allow.`;
    return s === 'hybrid' ? `Hybrid progression: double progression for reps/load, plus volume progression (${detail})` : `Volume progression: ${detail}`;
  }
  return STRATEGY_LABEL[s];
}
