import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVoidScope } from './voidAllScope.js';

test('whole-building void sends only allFloors', () => {
  assert.deepEqual(buildVoidScope('gisbert', 'all'), {
    building: 'gisbert',
    allFloors: true,
  });
});

test('single-floor void sends a numeric floor only', () => {
  assert.deepEqual(buildVoidScope('miguel_pro', '1'), {
    building: 'miguel_pro',
    floor: 1,
  });
});

test('invalid building or floor cannot widen the void scope', () => {
  assert.throws(() => buildVoidScope('Miguel Pro', 'all'));
  assert.throws(() => buildVoidScope('gisbert', ''));
  assert.throws(() => buildVoidScope('miguel_pro', '2'));
});
