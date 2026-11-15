import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPause } from './pause.ts';
import { generateSchedule } from './schedule.ts';
import type { Mesocycle, Microcycle } from '../types/index.ts';

const A: Microcycle = { id: 'a', name: 'A', archived: false, createdAt: 0, days: [{ weekday: 0, templateId: 'x' }, { weekday: 2, templateId: 'y' }, { weekday: 4, templateId: 'x' }] };
const meso: Mesocycle = { id: 'M', name: 'B', startDate: '2026-11-16', weeks: 4, pattern: 'repeat', sequence: ['a', 'a', 'a', 'a'], status: 'active', createdAt: 0 };

test('pausing mid-week shifts only remaining sessions by whole weeks', () => {
  const sched = generateSchedule(meso, [A]); sched[0].status = 'completed'; // Monday done
  const r = applyPause(meso, sched, '2026-11-18', '2026-11-25');
  assert.equal(r.meso.weeks, 5); assert.equal(r.scheduled.length, 12);
  assert.equal(r.scheduled[0].date, '2026-11-16');                // completed stays
  assert.equal(r.scheduled[1].date, '2026-11-25');                // Wed -> next Wed
  assert.equal(r.scheduled[3].date, '2026-11-30');                // week 2 Monday
  assert.equal(r.scheduled[11].date, '2026-12-18', 'last Friday (12-11) moves one week');
  assert.deepEqual(r.meso.pauses, [{ from: '2026-11-18', to: '2026-11-25', weeks: 1 }]);
  assert.equal(r.meso.sequence.length, 5);
});
test('longer pause adds empty weeks; validation', () => {
  const r = applyPause(meso, generateSchedule(meso, [A]), '2026-11-23', '2026-12-08');
  assert.equal(r.meso.weeks, 7); assert.deepEqual(r.meso.sequence.slice(1, 4), ['a', '', '']);
  assert.throws(() => applyPause(meso, [], '2026-11-23', '2026-11-23'));
  assert.throws(() => applyPause(meso, [], '2027-03-01', '2027-03-08'));
});
