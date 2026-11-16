import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, type Ctx } from './engine.ts';
import { assessReadiness } from './readiness.ts';
import { allowedStrategies, validateProgression } from './strategies.ts';
import { FINDING_BY_ID } from '../../research/findings.ts';
import type { PreWorkoutCheckIn } from '../types/index.ts';

const ci = (o: Partial<PreWorkoutCheckIn> = {}): PreWorkoutCheckIn => ({ id: 'c', date: 'd', sleepHours: 8, sleepQuality: 4, fatigue: 2, soreness: 2, recovery: 4, stress: 2, mentalFatigue: 2, motivation: 4, readiness: 4, jointDiscomfort: 1, jointPain: 1, unwell: false, hydration: 3, createdAt: 0, ...o });
const sess = (reps: number[], rir = 2, weight = 60) => ({ date: 'x', sets: reps.map(r => ({ weight, reps: r, rir })) });
const ctx = (o: Partial<Ctx> = {}): Ctx => ({ progression: { strategy: 'double' }, level: 'intermediate', prescribed: { sets: 3, repMin: 8, repMax: 12, rir: 2 }, sessions: [sess([10, 10, 9])], readiness: assessReadiness(ci()), weekIndex: 0, totalWeeks: 5, ...o });

test('spec example: reps before load', () => {
  const r = recommend(ctx());
  assert.equal(r.action, 'add_reps');
  assert.deepEqual(r.targets.map(t => [t.weight, t.repMin, t.repMax]), [[60, 10, 11], [60, 10, 11], [60, 9, 10]]);
  assert.ok(r.reasons.length > 0 && r.research.every(id => FINDING_BY_ID.has(id)));
});
test('top of range with good readiness suggests an exercise-increment load increase', () => {
  const r = recommend(ctx({ sessions: [sess([12, 12, 12])], step: 2.5 }));
  assert.equal(r.action, 'increase_load');
  assert.equal(r.targets[0].weight, 62.5);
  assert.deepEqual([r.targets[0].repMin, r.targets[0].repMax], [8, 9]);
});
test('same performance but poor readiness does not blindly progress', () => {
  const bad = assessReadiness(ci({ sleepHours: 4.5, stress: 5, mentalFatigue: 5, jointDiscomfort: 4 }));
  assert.equal(bad.level, 'low');
  const r = recommend(ctx({ sessions: [sess([12, 12, 12])], readiness: bad }));
  assert.equal(r.action, 'maintain');
  assert.equal(r.targets[0].weight, 60);
});
test('one bad night alone is only a minor flag', () => {
  const r = assessReadiness(ci({ sleepHours: 5 }));
  assert.equal(r.level, 'moderate');
  assert.equal(recommend(ctx({ sessions: [sess([12, 12, 12])], readiness: r })).action, 'increase_load');
});
test('joint pain or illness blocks progression even before an exercise has history', () => {
  const noHistory = recommend(ctx({ sessions: [], readiness: assessReadiness(ci({ jointPain: 4 })) }));
  assert.equal(noHistory.action, 'hold_caution');
  assert.ok(noHistory.flags.includes('safety'));
});
test('joint pain or illness blocks progression and advises caution', () => {
  const r = recommend(ctx({ sessions: [sess([12, 12, 12])], readiness: assessReadiness(ci({ jointPain: 4 })) }));
  assert.equal(r.action, 'hold_caution');
  assert.ok(r.flags.includes('safety'));
});
test('underperformance holds the load and is flagged when persistent', () => {
  const r = recommend(ctx({ sessions: [sess([7, 7, 6]), sess([9, 9, 8]), sess([11, 10, 10])] }));
  assert.equal(r.action, 'maintain');
  assert.ok(r.flags.includes('consistent-underperformance'));
  assert.ok(r.reasons.some(x => x.includes('not the automatic answer')));
});
test('sets harder than prescribed RIR hold the load; missing RIR at the top also prevents a load jump', () => {
  const noRir = { date: 'x', sets: [{ weight: 60, reps: 12 }, { weight: 60, reps: 12 }, { weight: 60, reps: 12 }] };
  assert.equal(recommend(ctx({ sessions: [noRir], step: 2.5 })).action, 'maintain');
  assert.equal(recommend(ctx({ sessions: [sess([12, 12, 12], 0)] })).action, 'maintain');
  assert.equal(recommend(ctx({ sessions: [sess([12, 12, 12])], lastFeedback: { difficulty: 'hard', fatigue: 3, performance: 'met' } })).action, 'maintain');
});
test('strategies: manual, rep and load', () => {
  assert.equal(recommend(ctx({ progression: { strategy: 'manual' } })).action, 'manual');
  assert.equal(recommend(ctx({ progression: { strategy: 'rep' }, sessions: [sess([12, 12, 12])] })).action, 'maintain');
  assert.equal(recommend(ctx({ progression: { strategy: 'load' }, sessions: [sess([9, 9, 9])] })).action, 'increase_load');
  assert.equal(recommend(ctx({ sessions: [] })).action, 'start');
});
test('volume progression adds sets only when recovery allows, and deloads', () => {
  const noHistory = recommend(ctx({ progression: { strategy: 'hybrid', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: false } }, sessions: [], weekIndex: 2 }));
  assert.equal(noHistory.sets, 5);
  assert.equal(noHistory.setsChange, 'increase');
  const v = { strategy: 'volume' as const, volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: true } };
  const up = recommend(ctx({ progression: v, weekIndex: 2 }));
  assert.equal(up.sets, 5); assert.equal(up.setsChange, 'increase'); assert.equal(up.targets.length, 5);
  const held = recommend(ctx({ progression: v, weekIndex: 2, sessions: [sess([7, 7, 6])] }));
  assert.equal(held.sets, 3); assert.equal(held.setsChange, 'held');
  const d = recommend(ctx({ progression: v, weekIndex: 4 }));
  assert.equal(d.setsChange, 'deload'); assert.equal(d.sets, 2);
});
test('hybrid progression combines double progression with volume increases and deloads', () => {
  const hybrid = { strategy: 'hybrid' as const, volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: true } };
  const reps = recommend(ctx({ progression: hybrid }));
  assert.equal(reps.action, 'add_reps');
  assert.equal(reps.sets, 3);
  assert.equal(reps.targets[0].weight, 60);
  const load = recommend(ctx({ progression: hybrid, sessions: [sess([12, 12, 12])], weekIndex: 1 }));
  assert.equal(load.action, 'increase_load');
  assert.equal(load.sets, 4);
  assert.equal(load.setsChange, 'increase');
  assert.equal(load.targets.length, 4);
  const held = recommend(ctx({ progression: hybrid, weekIndex: 2, sessions: [sess([7, 7, 6])] }));
  assert.equal(held.sets, 3);
  assert.equal(held.setsChange, 'held');
  const deload = recommend(ctx({ progression: hybrid, weekIndex: 4 }));
  assert.equal(deload.sets, 2);
  assert.equal(deload.setsChange, 'deload');
});

test('muscle-specific volume is integrated with ordinary progression and respects recovery', () => {
  const plan = { extraSets: 2, reasons: ['Chest is below its preferred weekly minimum.'] };
  const up = recommend(ctx({ muscleVolumePlan: plan }));
  assert.equal(up.sets, 5);
  assert.equal(up.setsChange, 'increase');
  assert.ok(up.reasons.some(x => x.includes('preferred weekly minimum')));
  const held = recommend(ctx({ muscleVolumePlan: plan, readiness: assessReadiness(ci({ sleepHours: 4.5, stress: 5, mentalFatigue: 5 })) }));
  assert.equal(held.sets, 3);
  const noHistory = recommend(ctx({ sessions: [], muscleVolumePlan: plan }));
  assert.equal(noHistory.sets, 5);
  const combined = recommend(ctx({ progression: { strategy: 'hybrid', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: false } }, weekIndex: 2, muscleVolumePlan: plan }));
  assert.equal(combined.sets, 7); // +2 planned volume and +1 muscle allocation, on top of 3 prescribed.
  const deload = recommend(ctx({ progression: { strategy: 'hybrid', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: true } }, weekIndex: 4, muscleVolumePlan: plan }));
  assert.equal(deload.setsChange, 'deload');
  assert.equal(deload.sets, 2);
});

test('beginners cannot select volume or hybrid progression', () => {
  assert.ok(!allowedStrategies('beginner').includes('volume'));
  assert.ok(!allowedStrategies('beginner').includes('hybrid'));
  assert.ok(validateProgression('beginner', { strategy: 'volume', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: false } }));
  assert.ok(validateProgression('beginner', { strategy: 'hybrid', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: false } }));
  assert.equal(validateProgression('intermediate', { strategy: 'volume', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: false } }), null);
  assert.equal(validateProgression('intermediate', { strategy: 'hybrid', volume: { weeklySetChange: 1, maxExtraSets: 2, deloadLastWeek: false } }), null);
  assert.ok(validateProgression('advanced', { strategy: 'volume', volume: { weeklySetChange: 5, maxExtraSets: 2, deloadLastWeek: false } }));
});
