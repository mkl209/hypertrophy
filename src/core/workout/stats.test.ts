import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epley, summarize, previousSets, findPRs, isSetValid, toCompleted, effectiveRir } from './stats.ts';
import type { CompletedWorkout, WorkoutDraft } from '../types/index.ts';

const w = (id: string, t: number, sets: [number, number][], kind: 'working' | 'warmup' = 'working'): CompletedWorkout => ({
  id, date: '2026-11-16', startedAt: t, finishedAt: t, unit: 'kg', templateName: 'FBA',
  exercises: [{ id: 'e' + id, exerciseId: 'bench', exerciseName: 'Bench', prescribed: { sets: 3, repMin: 8, repMax: 12, rir: 2 }, sets: sets.map(([weight, reps], i) => ({ id: `${id}${i}`, kind, weight, reps })) }]
});

test('summary ignores warm-ups', () => {
  const a = w('1', 1, [[60, 10], [60, 10], [60, 9]]);
  a.exercises[0].sets.push({ id: 'wu', kind: 'warmup', weight: 20, reps: 10 });
  assert.deepEqual(summarize(a), { exercises: 1, sets: 3, reps: 29, volume: 1740 });
});
test('previous sets come from the latest workout containing the exercise', () => {
  const p = previousSets([w('1', 1, [[50, 10]]), w('2', 2, [[60, 10], [60, 9]])], 'bench')!;
  assert.deepEqual(p.sets.map(s => s.weight), [60, 60]);
  assert.equal(previousSets([], 'bench'), null);
  assert.equal(previousSets([w('1', 1, [[50, 10]])], 'squat'), null);
});
test('PRs need history and a genuine improvement', () => {
  const old = w('1', 1, [[60, 10]]);
  assert.equal(findPRs([old], w('2', 2, [[60, 8]])).length, 0);
  const prs = findPRs([old], w('3', 3, [[62.5, 10]]));
  assert.deepEqual(prs.map(p => p.type), ['weight', 'e1rm']);
  assert.equal(findPRs([], w('4', 4, [[100, 5]])).length, 0);
  assert.ok(epley(100, 5) > 100 && epley(100, 1) === 100);
});
test('set validation and draft conversion keep only done, valid sets', () => {
  const ok = { id: 's1', kind: 'working' as const, weight: '60', reps: '10', rir: '2', done: true, technique: 'myo-reps' as const };
  assert.equal(isSetValid({ ...ok, reps: '' }), false);
  assert.equal(isSetValid({ ...ok, reps: '8.5' }), false);
  assert.equal(isSetValid({ ...ok, weight: '0' }), true);
  const d: WorkoutDraft = { id: 'current', templateName: 'FBA', date: '2026-11-16', startedAt: 1, stage: 'finish', exercises: [{ id: 'x', exerciseId: 'bench', name: 'Bench', prescribed: { sets: 2, repMin: 8, repMax: 12, rir: 2 }, restSec: 90, list: [ok, { ...ok, id: 's2', done: false }] }] };
  const c = toCompleted(d, 'W', 9, 'kg');
  assert.equal(c.exercises[0].sets.length, 1);
  assert.deepEqual([c.exercises[0].sets[0].weight, c.exercises[0].sets[0].reps, c.exercises[0].sets[0].rir, c.exercises[0].sets[0].technique], [60, 10, 2, 'myo-reps']);
});

test('Myo-reps remain working sets and legacy failure records map to 0 RIR', () => {
  const myo = { id: 'm', kind: 'working' as const, technique: 'myo-reps' as const, weight: 20, reps: 15 };
  assert.equal(effectiveRir(myo), undefined);
  const legacyFailure = { id: 'f', kind: 'failure', weight: 20, reps: 10 } as unknown as import('../types/index.ts').CompletedSet;
  assert.equal(effectiveRir(legacyFailure), 0);
  assert.equal(summarize({ ...w('myo', 1, [[20, 15]]), exercises: [{ ...w('myo', 1, [[20, 15]]).exercises[0], sets: [myo] }] }).sets, 1);
});
