import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityFromRow, categoryWrites } from '../src/activityRows.ts';

test('a short row has no category', () => {
  assert.deepEqual(activityFromRow(['a', 'Gym']), { id: 'a', name: 'Gym', status: 'active', category: undefined });
});

test('an unknown stored category is dropped', () => {
  assert.equal(activityFromRow(['a', 'Gym', 'active', 'nope']).category, undefined);
});

test('a stored category is read', () => {
  assert.equal(activityFromRow(['a', 'Gym', 'active', 'bad']).category, 'bad');
});

test('categoryWrites skips ids that are gone and uses real rows', () => {
  assert.deepEqual(categoryWrites([['a'], ['b'], ['c']], { c: 'bad', gone: 'move' }), [{ row: 4, category: 'bad' }]);
});
