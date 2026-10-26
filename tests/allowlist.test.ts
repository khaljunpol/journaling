import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowed, parseAllowlist } from '../lib/allowlist.ts';

test('empty list lets nobody in', () => {
  assert.equal(isEmailAllowed('a@b.c', []), false);
});

test('missing email is never allowed', () => {
  assert.equal(isEmailAllowed(null, ['a@b.c']), false);
  assert.equal(isEmailAllowed(undefined, ['a@b.c']), false);
});

test('spaces and caps still match', () => {
  assert.equal(isEmailAllowed(' A@B.C ', parseAllowlist(' a@b.c , x@y.z')), true);
  assert.equal(isEmailAllowed('Alex@Gmail.com', parseAllowlist(' Alex@Gmail.com , x@y.z')), true);
});

test('parseAllowlist drops empties and handles undefined', () => {
  assert.deepEqual(parseAllowlist(undefined), []);
  assert.deepEqual(parseAllowlist(' A@b.c,, ,X@y.z '), ['a@b.c', 'x@y.z']);
});
