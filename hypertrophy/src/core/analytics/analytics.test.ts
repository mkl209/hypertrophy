import { test } from 'node:test';
import assert from 'node:assert/strict';
import { muscleVolume, weeklyMuscleSets, exerciseSessions, mesoSummary, readinessVsPerformance, pearson, workoutTotals, weeklyTotals, mesoEnd, phaseSummary } from './analytics.ts';
import type { CompletedWorkout, Mesocycle, ScheduledWorkout, PreWorkoutCheckIn } from '../types/index.ts';

let n = 0;
const wk = (date: string, exId: string, sets: [number, number][], o: Partial<CompletedWorkout> = {}): CompletedWorkout => ({
  id: `w${++n}`, date, startedAt: n, finishedAt: n, unit: 'kg', templateName: 'T', templateId: 'T1', mesocycleId: 'M',
  exercises: [{ id: `e${n}`, exerciseId: exId, exerciseName: exId, prescribed: { sets: 3, repMin: 8, repMax: 12, rir: 2 }, sets: sets.map(([weight, reps], i) => ({ id: `s${n}${i}`, kind: 'working' as const, weight, reps, rir: 2 })) }], ...o });
const EX = new Map([['bench', { primary: ['chest'], secondary: ['triceps', 'front'] }], ['push', { primary: ['triceps'], secondary: [] }]]);

test('muscle volume: direct, weighted indirect, frequency', () => {
  const ws = [wk('2026-11-16', 'bench', [[60, 10], [60, 10], [60, 9]]), wk('2026-11-18', 'push', [[20, 12], [20, 12]])];
  const r = new Map(muscleVolume(ws, EX, 0.5).map(x => [x.muscleId, x]));
  assert.deepEqual([r.get('chest')!.direct, r.get('chest')!.weighted], [3, 3]);
  assert.deepEqual([r.get('triceps')!.direct, r.get('triceps')!.indirect, r.get('triceps')!.weighted, r.get('triceps')!.sessions], [2, 3, 3.5, 1]);
  assert.equal(muscleVolume(ws, EX, 0).find(x => x.muscleId === 'triceps')!.weighted, 2);
  assert.equal(weeklyMuscleSets(ws, EX, 0.5, 'triceps')[0].weighted, 3.5);
});
test('totals and weekly grouping', () => {
  const ws = [wk('2026-11-16', 'bench', [[60, 10]]), wk('2026-11-23', 'bench', [[60, 10], [60, 10]])];
  assert.deepEqual(workoutTotals(ws), { sessions: 2, sets: 3, reps: 30, volume: 1800 });
  assert.deepEqual(weeklyTotals(ws).map(w => [w.week, w.sets]), [['2026-11-16', 1], ['2026-11-23', 2]]);
});
test('exercise sessions and PR flags', () => {
  const s = exerciseSessions([wk('2026-11-16', 'bench', [[60, 10]]), wk('2026-11-18', 'bench', [[60, 8]]), wk('2026-11-20', 'bench', [[65, 10]])], 'bench');
  assert.deepEqual(s.map(x => [x.prWeight, x.prE1rm]), [[false, false], [false, false], [true, true]]);
});
test('mesocycle summary uses completed workouts and scheduled statuses', () => {
  const meso: Mesocycle = { id: 'M', name: 'A', startDate: '2026-11-16', weeks: 2, pattern: 'repeat', sequence: ['a', 'a'], status: 'active', createdAt: 0 };
  assert.equal(mesoEnd(meso), '2026-11-29');
  const sc = (id: string, date: string, status: ScheduledWorkout['status']): ScheduledWorkout => ({ id, mesocycleId: 'M', weekIndex: 0, date, originalDate: date, templateId: 'T1', status });
  const s = mesoSummary(meso, [sc('1', '2026-11-16', 'completed'), sc('2', '2026-11-18', 'missed'), sc('3', '2026-11-20', 'scheduled'), sc('4', '2026-11-23', 'scheduled')], [wk('2026-11-16', 'bench', [[60, 10], [60, 10]])], [], [], '2026-11-22');
  assert.deepEqual([s.planned, s.due, s.completed, s.missed, s.completionRate], [4, 3, 1, 2, 1 / 3]);
  assert.equal(s.weeks[0].sets, 2); assert.equal(s.weeks[1].sessions, 0); assert.equal(s.weeks[0].avgRir, 2);
});
test('readiness vs performance needs enough pairs and reports correlation only', () => {
  assert.equal(pearson([1, 2, 3], [1, 2, 3]), null);
  assert.ok(Math.abs((pearson([1, 2, 3, 4, 5, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16]) as number) - 1) < 1e-9);
  const cs: PreWorkoutCheckIn[] = []; const ws: CompletedWorkout[] = [];
  for (let i = 0; i < 4; i++) { const c = { id: 'c' + i, readiness: 3 } as PreWorkoutCheckIn; cs.push(c); ws.push(wk(`2026-11-${10 + i}`, 'bench', [[60, 10 + i]], { checkinId: c.id })); }
  const r = readinessVsPerformance(ws, cs); assert.equal(r.pairs.length, 3); assert.equal(r.r, null);
});
test('phase summary', () => {
  const p = { id: 'p', goal: 'bulk' as const, name: 'b', startDate: '2026-11-01', calories: 3000, protein: 180, carbs: 300, fat: 80 };
  const food = (date: string, calories: number) => ({ id: date, date, name: 'x', calories, protein: 100, carbs: 0, fat: 0, fibre: 0, createdAt: 0 });
  const s = phaseSummary(p, [food('2026-11-01', 2800), food('2026-11-02', 3200)], [], '2026-11-10');
  assert.equal(s.avgKcal, 3000); assert.equal(s.loggedDays, 2); assert.equal(s.span, 10); assert.equal(s.rate, null);
});
