import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kcalFromMacros, phaseForDate, sumFoods, remaining, weekSummary, movingAverage, weeklyRate } from './nutrition.ts';
import type { FoodEntry, NutritionPhase } from '../types/index.ts';

const ph = (id: string, goal: NutritionPhase['goal'], startDate: string, endDate?: string): NutritionPhase => ({ id, goal, name: id, startDate, endDate, calories: 3000, protein: 180, carbs: 350, fat: 80 });
const food = (date: string, calories: number, protein = 0): FoodEntry => ({ id: date + calories, date, name: 'x', calories, protein, carbs: 0, fat: 0, fibre: 0, createdAt: 0 });

test('macro calories and totals', () => {
  assert.equal(kcalFromMacros(30, 50, 10), 410);
  const t = sumFoods([food('2026-11-16', 500, 40), food('2026-11-16', 300, 20)]);
  assert.equal(t.calories, 800); assert.equal(t.protein, 60);
  assert.deepEqual(remaining({ calories: 3000, protein: 180, carbs: 350, fat: 80 }, t), { calories: 2200, protein: 120, carbs: 350, fat: 80 });
});
test('phase lookup keeps history across bulk to cut', () => {
  const phases = [ph('bulk', 'bulk', '2026-01-01', '2026-06-30'), ph('cut', 'cut', '2026-07-01')];
  assert.equal(phaseForDate(phases, '2026-03-01')?.goal, 'bulk');
  assert.equal(phaseForDate(phases, '2026-06-30')?.goal, 'bulk');
  assert.equal(phaseForDate(phases, '2026-12-25')?.goal, 'cut');
  assert.equal(phaseForDate(phases, '2025-12-31'), undefined);
});
test('weekly averages ignore unlogged days', () => {
  const s = weekSummary([food('2026-11-16', 3000, 180), food('2026-11-18', 2000, 100)], [ph('b', 'bulk', '2026-01-01')], '2026-11-20');
  assert.equal(s.start, '2026-11-16'); assert.equal(s.loggedDays, 2);
  assert.equal(s.avg.calories, 2500); assert.equal(s.proteinHitDays, 1);
});
test('moving average uses a calendar window', () => {
  const m = movingAverage([{ date: '2026-11-01', weight: 80 }, { date: '2026-11-02', weight: 81 }, { date: '2026-11-20', weight: 82 }]);
  assert.equal(m[1].avg, 80.5); assert.equal(m[2].avg, 82);
});
test('weekly rate of change', () => {
  const e = Array.from({ length: 15 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, weight: 80 + i * 0.1 }));
  assert.ok(Math.abs((weeklyRate(e) as number) - 0.7) < 1e-9);
  assert.equal(weeklyRate(e.slice(0, 2)), null);
  assert.equal(weeklyRate([]), null);
});
