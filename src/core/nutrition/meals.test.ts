import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMinutes, allocateMealTargets, DEFAULT_NUTRITION_SCHEDULE, mealTime } from './meals.ts';
import type { NutritionPhase } from '../types/index.ts';

const phase: NutritionPhase = { id: 'p', goal: 'bulk', name: 'Bulk', startDate: '2026-01-01', calories: 3000, protein: 180, carbs: 350, fat: 80, fibre: 30 };

test('workout-relative meals move when training time changes, including midnight wrap', () => {
  const pre = DEFAULT_NUTRITION_SCHEDULE.meals.find(m => m.id === 'pre-workout')!;
  assert.equal(mealTime(pre, DEFAULT_NUTRITION_SCHEDULE), '18:30');
  assert.equal(mealTime(pre, { ...DEFAULT_NUTRITION_SCHEDULE, workoutTime: '17:00' }), '15:30');
  assert.equal(addMinutes('00:30', -90), '23:00');
});

test('meal targets sum to daily macros and bias carbs toward training', () => {
  const targets = allocateMealTargets(phase, DEFAULT_NUTRITION_SCHEDULE.meals);
  assert.equal(targets.reduce((n, x) => n + x.protein, 0), phase.protein);
  assert.equal(targets.reduce((n, x) => n + x.carbs, 0), phase.carbs);
  assert.equal(targets.reduce((n, x) => n + x.fat, 0), phase.fat);
  assert.ok(targets.find(x => x.meal.id === 'post-workout')!.carbs > targets.find(x => x.meal.id === 'bedtime')!.carbs);
  assert.ok(targets.find(x => x.meal.id === 'pre-workout')!.fat < targets.find(x => x.meal.id === 'dinner')!.fat);
});

test('logging food redistributes remaining macros across meals not yet logged', () => {
  const logged = [{ id: 'f', date: '2026-11-16', name: 'Meal', calories: 600, protein: 40, carbs: 70, fat: 15, fibre: 5, createdAt: 1, mealId: 'breakfast' }];
  const targets = allocateMealTargets(phase, DEFAULT_NUTRITION_SCHEDULE.meals, logged);
  assert.equal(targets.filter(x => x.meal.id !== 'breakfast').reduce((n, x) => n + x.protein, 0), phase.protein - 40);
  assert.equal(targets.find(x => x.meal.id === 'breakfast')!.redistributed, false);
  assert.equal(targets.find(x => x.meal.id === 'lunch')!.redistributed, true);
  assert.ok(targets.find(x => x.meal.id === 'lunch')!.protein > 0);
});
