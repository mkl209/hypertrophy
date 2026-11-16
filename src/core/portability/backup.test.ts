import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyImport, buildBackup, emptyTables, previewImport, validateBackup } from './backup.ts';

const tables = () => { const t = emptyTables(); t.exercises = [{ id: 'a', name: 'Bench' }]; t.weights = [{ date: '2026-11-01', weight: 80 }]; return t; };

test('export then validate round-trips', () => {
  const v = validateBackup(JSON.parse(JSON.stringify(buildBackup(tables(), '2026-11-15T00:00:00Z'))));
  assert.equal(v.ok, true); assert.equal(v.backup!.data.exercises!.length, 1);
});
test('invalid files are rejected with clear errors', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup([]).ok, false);
  assert.match(validateBackup({ app: 'other' }).errors[0], /not created by/);
  assert.match(validateBackup({ app: 'hypertrophy-coach', schemaVersion: 99, data: {} }).errors[0], /newer version/);
  assert.equal(validateBackup({ app: 'hypertrophy-coach', schemaVersion: 1, data: { exercises: 'x' } }).ok, false);
  assert.equal(validateBackup({ app: 'hypertrophy-coach', schemaVersion: 1, data: { exercises: [{ name: 'no id' }] } }).ok, false);
  assert.equal(validateBackup({ app: 'hypertrophy-coach', schemaVersion: 1, data: { exercises: [{ id: 'a' }, { id: 'a' }] } }).ok, false);
  const w = validateBackup({ app: 'hypertrophy-coach', schemaVersion: 1, data: { mystery: [] } });
  assert.equal(w.ok, true); assert.equal(w.warnings.length, 1);
});
test('preview detects duplicates and changes', () => {
  const inc = tables(); inc.exercises = [{ id: 'a', name: 'Bench (edited)' }, { id: 'b', name: 'Squat' }];
  const p = previewImport(tables(), buildBackup(inc, 'x')).find(x => x.table === 'exercises')!;
  assert.deepEqual([p.incoming, p.added, p.duplicates, p.changed], [2, 1, 1, 1]);
});
test('replace, merge-keep and merge-overwrite behave explicitly', () => {
  const inc = tables(); inc.exercises = [{ id: 'a', name: 'Changed' }, { id: 'b', name: 'New' }];
  const b = buildBackup(inc, 'x');
  assert.deepEqual(applyImport(tables(), b, 'replace').exercises.map(r => r.name), ['Changed', 'New']);
  assert.deepEqual(applyImport(tables(), b, 'merge-keep').exercises.map(r => r.name), ['Bench', 'New']);
  assert.deepEqual(applyImport(tables(), b, 'merge-overwrite').exercises.map(r => r.name), ['Changed', 'New']);
  assert.equal(applyImport(tables(), { ...b, data: { exercises: [] } }, 'replace').weights.length, 1); // absent sections untouched
});
test('export, reset, import restores everything', () => {
  const orig = tables(); const b = JSON.parse(JSON.stringify(buildBackup(orig, 'x')));
  const restored = applyImport(emptyTables(), validateBackup(b).backup!, 'replace');
  assert.deepEqual(restored, { ...emptyTables(), exercises: orig.exercises, weights: orig.weights });
});

test('running sessions are included in backup export and restore', () => {
  const original = tables();
  original.runs = [{ id: 'run-1', date: '2026-11-16', distanceKm: 5, durationMinutes: 28, effort: 3 }];
  const backup = validateBackup(JSON.parse(JSON.stringify(buildBackup(original, 'x'))));
  assert.equal(backup.ok, true);
  const restored = applyImport(emptyTables(), backup.backup!, 'replace');
  assert.deepEqual(restored.runs, original.runs);
});
