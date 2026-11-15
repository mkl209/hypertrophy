import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence, generateSchedule } from './schedule.ts';
import type { Mesocycle, Microcycle } from '../types/index.ts';

const mk = (id: string, days: [number, string][]): Microcycle => ({ id, name: id, archived: false, createdAt: 0, days: days.map(([weekday, templateId]) => ({ weekday, templateId })) });
const A = mk('A', [[0, 'FBA'], [2, 'FBB'], [4, 'FBA']]);
const B = mk('B', [[1, 'X'], [3, 'Y']]);
const meso = (start: string, weeks: number, sequence: string[]): Mesocycle => ({ id: 'M', name: 'Block A', startDate: start, weeks, pattern: 'repeat', sequence, status: 'active', createdAt: 0 });

test('repeat Week A for 5 weeks from a Monday', () => {
  const s = generateSchedule(meso('2026-11-16', 5, buildSequence('repeat', ['A'], 5)), [A]);
  assert.equal(s.length, 15);
  assert.equal(s[0].date, '2026-11-16');
  assert.deepEqual(s.slice(0, 3).map(x => x.templateId), ['FBA', 'FBB', 'FBA']);
  assert.equal(s[14].date, '2026-12-18'); // Friday of week 5
});
test('alternate A/B over 5 weeks gives A B A B A', () => {
  assert.deepEqual(buildSequence('alternate', ['A', 'B'], 5), ['A', 'B', 'A', 'B', 'A']);
  const s = generateSchedule(meso('2026-11-16', 5, ['A', 'B', 'A', 'B', 'A']), [A, B]);
  assert.equal(s.length, 3 + 2 + 3 + 2 + 3);
  assert.equal(s.find(x => x.weekIndex === 1)!.templateId, 'X');
});
test('mid-week start skips earlier days, crosses month and year boundaries', () => {
  const s = generateSchedule(meso('2026-12-30', 2, ['A', 'A']), [A]); // Wednesday
  assert.deepEqual(s.map(x => x.date), ['2026-12-30', '2027-01-01', '2027-01-04', '2027-01-06', '2027-01-08']);
});
test('custom sequence and validation', () => {
  assert.deepEqual(buildSequence('custom', ['A', 'B', 'B'], 3), ['A', 'B', 'B']);
  assert.throws(() => buildSequence('custom', ['A'], 3));
  assert.throws(() => buildSequence('repeat', [], 3));
  assert.throws(() => generateSchedule(meso('2026-11-16', 1, ['nope']), [A]));
});
test('same template twice a week gets unique ids', () => {
  const dup = mk('D', [[0, 'T'], [0, 'T']]);
  const s = generateSchedule(meso('2026-11-16', 1, ['D']), [dup]);
  assert.equal(new Set(s.map(x => x.id)).size, 2);
});
