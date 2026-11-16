export interface MuscleVolumePreference { min?: number; max?: number }
export interface VolumeExercise {
  id: string;
  sets: number;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}
export interface MuscleVolumeAllocation {
  extraSets: Record<string, number>;
  projected: Record<string, number>;
  reasons: Record<string, string[]>;
}

/**
 * Allocate a small number of additional sets to exercises that address muscles
 * below their configured weekly minimum. The projection includes the week's
 * completed work, remaining scheduled work and the current workout's baseline.
 * Maximums are hard guardrails; minimums are thresholds, never volume targets
 * to exceed. Indirect work uses the same configurable weighting as analytics.
 */
export function allocateMuscleVolume(
  exercises: VolumeExercise[],
  completedAndScheduled: Record<string, number>,
  preferences: Record<string, MuscleVolumePreference>,
  secondaryWeight: number,
  maxExtraSetsPerExercise = 2
): MuscleVolumeAllocation {
  const projected = { ...completedAndScheduled };
  const extraSets: Record<string, number> = Object.fromEntries(exercises.map(e => [e.id, 0]));
  const reasons: Record<string, string[]> = Object.fromEntries(exercises.map(e => [e.id, []]));
  const contribution = (e: VolumeExercise) => {
    const out: Record<string, number> = {};
    for (const id of e.primaryMuscles) out[id] = 1;
    for (const id of e.secondaryMuscles) if (!(id in out)) out[id] = secondaryWeight;
    return out;
  };
  const contributions = new Map(exercises.map(e => [e.id, contribution(e)]));
  // Include the current workout's prescribed sets before deciding whether it
  // needs any additional work to reach a muscle's minimum.
  for (const e of exercises) for (const [muscle, amount] of Object.entries(contributions.get(e.id)!)) {
    projected[muscle] = (projected[muscle] ?? 0) + amount * e.sets;
  }
  const configured = Object.keys(preferences).filter(id => preferences[id]?.min !== undefined || preferences[id]?.max !== undefined);
  const initialDeficit = Object.fromEntries(configured.map(id => [id, Math.max(0, (preferences[id]?.min ?? 0) - (projected[id] ?? 0))]));
  const deficit = (id: string) => Math.max(0, (preferences[id]?.min ?? 0) - (projected[id] ?? 0));
  for (let pass = 0; pass < maxExtraSetsPerExercise * Math.max(1, exercises.length); pass++) {
    let best: VolumeExercise | undefined;
    let bestGain = 0;
    for (const e of exercises) {
      if ((extraSets[e.id] ?? 0) >= maxExtraSetsPerExercise) continue;
      const gains = contributions.get(e.id)!;
      const relevant = Object.entries(gains).filter(([id]) => configured.includes(id));
      if (!relevant.length) continue;
      // A compound set is only added when it stays within every configured
      // maximum it affects, not merely the muscle with the largest deficit.
      const exceedsMax = relevant.some(([id, amount]) => preferences[id]?.max !== undefined && (projected[id] ?? 0) + amount > (preferences[id].max as number) + 1e-9);
      if (exceedsMax) continue;
      const gain = relevant.reduce((sum, [id, amount]) => sum + Math.min(deficit(id), amount), 0);
      if (gain > bestGain + 1e-9) { best = e; bestGain = gain; }
    }
    if (!best || bestGain <= 0) break;
    extraSets[best.id]++;
    for (const [id, amount] of Object.entries(contributions.get(best.id)!)) projected[id] = (projected[id] ?? 0) + amount;
  }
  for (const e of exercises) {
    const n = extraSets[e.id] ?? 0;
    if (n > 0) {
      const muscles = Object.entries(contributions.get(e.id)!).filter(([id]) => (initialDeficit[id] ?? 0) > 0).map(([id]) => id);
      reasons[e.id].push(`Added ${n} set${n === 1 ? '' : 's'} because ${muscles.join(', ')} ${muscles.length === 1 ? 'is' : 'are'} below your preferred weekly minimum. The increase stops at the minimum and respects configured maximums.`);
    }
  }
  return { extraSets, projected, reasons };
}
