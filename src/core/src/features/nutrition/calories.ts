import type { NutritionGoal } from '../types/index.ts';

/** Starting suggestions only. The adjustment is always editable per phase. */
export const DEFAULT_ADJUSTMENT: Record<NutritionGoal, number> = { bulk: 300, maintain: 0, cut: -500 };

/** Calories are a range, not a line: within this many kcal of target counts as on target. */
export const DEFAULT_TOLERANCE = 100;

export const toleranceOf = (p: { tolerance?: number } | null | undefined): number => p?.tolerance ?? DEFAULT_TOLERANCE;

export const withinTarget = (kcal: number, target: number, tol: number): boolean => Math.abs(kcal - target) <= tol;

/** "+300" / "−500" (proper minus sign). */
export const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}`;

/**
 * Maintenance and adjustment for a phase. Phases saved before this feature only have a
 * target (`calories`), so we derive a maintenance that reproduces the same target.
 */
export function phaseEnergy(p: { goal: NutritionGoal; calories: number; maintenance?: number; adjustment?: number }): { maintenance: number; adjustment: number } {
  const adjustment = p.adjustment ?? DEFAULT_ADJUSTMENT[p.goal];
  const maintenance = p.maintenance ?? p.calories - adjustment;
  return { maintenance, adjustment };
}
