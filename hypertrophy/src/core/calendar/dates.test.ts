import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, weekdayMon0, startOfWeekMonday, weekIndex, isValidISODate, todayISO } from './dates.ts';

test('month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});
test('DST changeover does not shift day counts', () => {
  assert.equal(diffDays('2026-03-30', '2026-03-28'), 2);
  assert.equal(diffDays('2026-10-26', '2026-10-24'), 2);
});
test('weekdays are Monday-based', () => {
  assert.equal(weekdayMon0('2026-11-16'), 0);
  assert.equal(weekdayMon0('2026-11-15'), 6);
  assert.equal(startOfWeekMonday('2026-11-18'), '2026-11-16');
});
test('weekIndex counts calendar weeks from block start', () => {
  assert.equal(weekIndex('2026-11-16', '2026-11-16'), 0);
  assert.equal(weekIndex('2026-11-16', '2026-11-22'), 0);
  assert.equal(weekIndex('2026-11-16', '2026-11-23'), 1);
  assert.equal(weekIndex('2026-11-16', '2026-11-15'), -1);
});
test('validation and local today', () => {
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(isValidISODate('2026-02-28'), true);
  assert.equal(todayISO(new Date(2026, 5, 1, 23, 59)), '2026-06-01');
});
