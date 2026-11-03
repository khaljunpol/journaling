import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelShare } from '../src/logic/level.ts';
import { levelFor } from '@journaling/core/scoring';

test('levelShare: the way into the current level, 0 to 1', () => {
  const l = levelFor(18370);
  const share = levelShare({ points: 18370 });
  assert.ok(share > 0 && share < 1);
  assert.ok(Math.abs(share - l.into / l.cost) < 1e-9);
  assert.equal(levelShare({ points: 0 }), 0);
});
