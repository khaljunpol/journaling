import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClimbLogBody } from '../src/lib/climbLogInput.ts';

const maxLen = { grade: 5, location: 10, notes: 20 };

test('valid body parses, Rope becomes rope', () => {
  const r = parseClimbLogBody({ date: '2026-10-27T10:00:00Z', session: '2', type: 'Rope', grade: ' 6a ', attempts: 3, location: ' Gym ', notes: ' hi ' }, maxLen);
  assert.deepEqual(r, { ok: true, value: { date: '2026-10-27', session: 2, type: 'rope', grade: '6a', attempts: 3, location: 'Gym', notes: 'hi' } });
});

test('missing date fails', () => {
  assert.deepEqual(parseClimbLogBody({ grade: 'V1' }, maxLen), { ok: false, error: 'date required' });
  assert.deepEqual(parseClimbLogBody(null, maxLen), { ok: false, error: 'date required' });
});

test('grade over the limit uses the POST error text', () => {
  assert.deepEqual(parseClimbLogBody({ date: '2026-10-27', grade: 'toolong' }, maxLen), { ok: false, error: 'grade must be ≤5 characters' });
});

test('attempts "0" is 0 and unknown type is boulder', () => {
  const r = parseClimbLogBody({ date: '2026-10-27', attempts: '0', type: 'x' }, maxLen);
  assert.equal(r.ok && r.value.attempts, 0);
  assert.equal(r.ok && r.value.type, 'boulder');
});
