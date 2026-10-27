import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleUnconfirmed, enqueue, classify, onResult, due, backoffMs, nextToSend } from '../src/lib/outbox.ts';

const mk = (key: string, body: unknown = {}) => ({ key, url: '/api/x', method: 'POST' as const, body });

test('same key replaces body and resets attempts', () => {
  let q = enqueue([], mk('mood:2026-10-26', { score: 3 }), 1000);
  q = onResult(q, 'mood:2026-10-26', 'retry', 1000);
  assert.equal(q[0].attempts, 1);
  q = enqueue(q, mk('mood:2026-10-26', { score: 5 }), 2000);
  assert.equal(q.length, 1);
  assert.deepEqual(q[0].body, { score: 5 });
  assert.equal(q[0].attempts, 0);
  assert.equal(q[0].state, 'pending');
  assert.equal(q[0].nextAt, 2000);
});

test('different log keys are both kept', () => {
  let q = enqueue([], mk('log:2026-10-26:a'), 0);
  q = enqueue(q, mk('log:2026-10-26:b'), 0);
  assert.equal(q.length, 2);
});

test('classify', () => {
  for (const s of [200, 201]) assert.equal(classify(s), 'done');
  for (const s of [500, 502, 'network'] as const) assert.equal(classify(s), 'retry');
  for (const s of [400, 422]) assert.equal(classify(s), 'failed');
  for (const s of [401, 403]) assert.equal(classify(s), 'auth');
});

test('done removes the item', () => {
  const q = onResult(enqueue([], mk('a'), 0), 'a', 'done', 5);
  assert.equal(q.length, 0);
});

test('retry bumps attempts and schedules backoff', () => {
  const q = onResult(enqueue([], mk('a'), 0), 'a', 'retry', 1000);
  assert.equal(q[0].attempts, 1);
  assert.equal(q[0].nextAt, 1000 + 2000);
  assert.equal(q[0].state, 'pending');
});

test('failed stays in queue with state failed', () => {
  const q = onResult(enqueue([], mk('a'), 0), 'a', 'failed', 1000);
  assert.equal(q.length, 1);
  assert.equal(q[0].state, 'failed');
});

test('auth keeps the item untouched', () => {
  const start = enqueue([], mk('a'), 0);
  assert.deepEqual(onResult(start, 'a', 'auth', 1000), start);
});

test('due respects nextAt and skips failed', () => {
  let q = enqueue([], mk('a'), 0);
  q = enqueue(q, mk('b'), 0);
  q = onResult(q, 'a', 'retry', 1000);
  assert.deepEqual(due(q, 1500).map((i) => i.key), ['b']);
  assert.deepEqual(due(q, 3000).map((i) => i.key).sort(), ['a', 'b']);
  q = onResult(q, 'b', 'failed', 3000);
  assert.deepEqual(due(q, 99999).map((i) => i.key), ['a']);
});

test('backoffMs doubles and caps at 5 min', () => {
  assert.equal(backoffMs(1), 2000);
  assert.equal(backoffMs(2), 4000);
  assert.equal(backoffMs(3), 8000);
  assert.equal(backoffMs(50), 300000);
});

import { mergeQueues } from '../src/lib/outbox.ts';

test('enqueue stamps updatedAt', () => {
  assert.equal(enqueue([], mk('a'), 777)[0].updatedAt, 777);
});

test('merge keeps an item another tab added', () => {
  const a = enqueue([], mk('a'), 1);
  const b = enqueue(a, mk('b'), 2);
  // this tab only knows a; storage (other tab) has a + b
  assert.deepEqual(mergeQueues(b, a, a).map((i) => i.key).sort(), ['a', 'b']);
});

test('merge keeps my new item when storage lacks it', () => {
  const stored = enqueue([], mk('a'), 1);
  const local = enqueue(stored, mk('b'), 2);
  assert.deepEqual(mergeQueues(stored, local, stored).map((i) => i.key).sort(), ['a', 'b']);
});

test('merge: newer enqueue wins for the same key', () => {
  const base = enqueue([], mk('a', 1), 1);
  const stored = enqueue(base, mk('a', 2), 5);
  const merged = mergeQueues(stored, base, base);
  assert.equal(merged[0].body, 2);
  const merged2 = mergeQueues(base, stored, base);
  assert.equal(merged2[0].body, 2);
});

test('merge: same stamp prefers local progress', () => {
  const base = enqueue([], mk('a'), 1);
  const local = onResult(base, 'a', 'retry', 10);
  assert.equal(mergeQueues(base, local, base)[0].attempts, 1);
});

test('merge: item finished here is not resurrected from storage', () => {
  const base = enqueue([], mk('a'), 1);
  assert.equal(mergeQueues(base, [], base).length, 0);
});

test('merge: item finished in the other tab is dropped here', () => {
  const base = enqueue([], mk('a'), 1);
  assert.equal(mergeQueues([], base, base).length, 0);
});

test('merge: re-enqueue after finishing here survives', () => {
  const base = enqueue([], mk('a', 1), 1);
  const local = enqueue([], mk('a', 2), 9);
  assert.equal(mergeQueues(base, local, base)[0].body, 2);
});

import { nextBase } from '../src/lib/outbox.ts';

test('nextBase only advances after a successful write', () => {
  const oldBase = enqueue([], mk('a'), 1);
  const merged = enqueue(oldBase, mk('x'), 2);
  assert.equal(nextBase(oldBase, merged, true), merged);
  assert.equal(nextBase(oldBase, merged, false), oldBase);
});

test('failed write: an unsent item survives the next commit', () => {
  let base: ReturnType<typeof enqueue> = [];
  const stored: ReturnType<typeof enqueue> = []; // writes fail, storage stays empty
  let local = enqueue([], mk('x'), 1);
  let merged = mergeQueues(stored, local, base);
  base = nextBase(base, merged, false);
  local = enqueue(merged, mk('y'), 2);
  merged = mergeQueues(stored, local, base);
  assert.deepEqual(merged.map((i) => i.key).sort(), ['x', 'y']);
});

test('settleUnconfirmed: same user clears the flag and keeps everything', () => {
  let q = enqueue([], mk('mood:a'), 0);
  q = enqueue(q, { ...mk('weight:a'), unconfirmed: true }, 0);
  const out = settleUnconfirmed(q, true);
  assert.equal(out.length, 2);
  assert.ok(out.every((x) => x.unconfirmed === undefined));
});

test('settleUnconfirmed: other user drops flagged items only', () => {
  let q = enqueue([], mk('mood:a'), 0);
  q = enqueue(q, { ...mk('weight:a'), unconfirmed: true }, 0);
  const out = settleUnconfirmed(q, false);
  assert.deepEqual(out.map((x) => x.key), ['mood:a']);
});

test('nextToSend: at most one due item per group, none for groups in flight', () => {
  let q: ReturnType<typeof enqueue> = [];
  for (let d = 10; d < 17; d++) q = enqueue(q, mk(`hours:2026-10-${d}`), 1000 + d);
  for (const id of ['a', 'b', 'c']) q = enqueue(q, mk(`log:2026-10-26:${id}`), 2000);
  q = enqueue(q, mk('mood:2026-10-26'), 3000);
  const out = nextToSend(q, 5000, new Set());
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((x) => x.key.split(':')[0]).sort(), ['hours', 'log', 'mood']);
  assert.equal(out.find((x) => x.key.startsWith('hours:'))!.key, 'hours:2026-10-10'); // oldest first
  const busy = nextToSend(q, 5000, new Set(['hours:2026-10-10']));
  assert.deepEqual(busy.map((x) => x.key.split(':')[0]).sort(), ['log', 'mood']);
});
