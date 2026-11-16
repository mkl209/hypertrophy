import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateMuscleVolume } from './muscleVolume.ts';

const exercise = (id: string, sets: number, primaryMuscles: string[], secondaryMuscles: string[] = []) => ({ id, sets, primaryMuscles, secondaryMuscles });

test('adds sets to an exercise that addresses a muscle below its weekly minimum', () => {
  const result = allocateMuscleVolume([exercise('press', 3, ['chest'], ['triceps'])], { chest: 5, triceps: 4 }, { chest: { min: 10, max: 14 } }, 0.5, 2);
  assert.equal(result.extraSets.press, 2);
  assert.equal(result.projected.chest, 10);
  assert.equal(result.projected.triceps, 6.5);
});

test('does not chase the maximum or add sets when the minimum is already met', () => {
  const result = allocateMuscleVolume([exercise('curl', 3, ['biceps'])], { biceps: 8 }, { biceps: { min: 8, max: 10 } }, 0.5, 2);
  assert.equal(result.extraSets.curl, 0);
  assert.equal(result.projected.biceps, 11);
});

test('maximum is a hard guardrail for compound and indirect contributions', () => {
  const result = allocateMuscleVolume([exercise('press', 3, ['chest'], ['triceps'])], { chest: 5, triceps: 8 }, { chest: { min: 10, max: 12 }, triceps: { min: 10, max: 9 } }, 0.5, 2);
  assert.equal(result.extraSets.press, 0);
});

test('allocates scarce extra sets to the greatest remaining weighted deficit', () => {
  const result = allocateMuscleVolume([
    exercise('chest-press', 2, ['chest']),
    exercise('lat-pulldown', 2, ['lats'])
  ], { chest: 3, lats: 4 }, { chest: { min: 10, max: 12 }, lats: { min: 8, max: 12 } }, 0.5, 1);
  assert.equal(result.extraSets['chest-press'], 1);
  assert.equal(result.extraSets['lat-pulldown'], 1);
});
