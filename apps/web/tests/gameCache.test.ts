import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedNumbers } from '../src/lib/gameCache.ts';

const full = { points: 100, level: 3, into: 10, toNext: 40, cost: 50, perfectDays: 2, today: { done: 1, total: 3 }, imported: true };

test('cachedNumbers: a full saved copy is used', () => {
  assert.deepEqual(cachedNumbers(full), full);
});

test('cachedNumbers: a partial copy (only the level) is ignored, so the page waits for the server', () => {
  assert.equal(cachedNumbers({ level: 25 }), null);
  assert.equal(cachedNumbers({ ...full, perfectDays: undefined }), null);
  assert.equal(cachedNumbers({ ...full, today: null }), null);
  assert.equal(cachedNumbers(null), null);
  assert.equal(cachedNumbers('x'), null);
});
