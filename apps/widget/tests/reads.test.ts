import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readsAfterTap } from '../src/logic/reads.ts';

test('readsAfterTap: only the widgets that have read before pay again', () => {
  assert.deepEqual(readsAfterTap({ game: null, world: null }), []);
  assert.deepEqual(readsAfterTap({ game: {}, world: null }), ['game']);
  assert.deepEqual(readsAfterTap({ game: {}, world: {} }), ['game', 'world']);
});
