import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLock } from '../src/keyedLock.ts';

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test('same key runs one after another', async () => {
  const log: string[] = [];
  const a = withLock('k', async () => { log.push('a start'); await tick(); log.push('a end'); });
  const b = withLock('k', async () => { log.push('b start'); await tick(); log.push('b end'); });
  await Promise.all([a, b]);
  assert.deepEqual(log, ['a start', 'a end', 'b start', 'b end']);
});

test('second still runs after the first throws', async () => {
  const log: string[] = [];
  const a = withLock('k2', async () => { log.push('a start'); await tick(); log.push('a throw'); throw new Error('boom'); });
  const b = withLock('k2', async () => { log.push('b start'); return 'ok'; });
  await assert.rejects(a, /boom/);
  assert.equal(await b, 'ok');
  assert.deepEqual(log, ['a start', 'a throw', 'b start']);
});

test('different keys run at the same time', async () => {
  const log: string[] = [];
  const a = withLock('x', async () => { log.push('x start'); await tick(); log.push('x end'); });
  const b = withLock('y', async () => { log.push('y start'); await tick(); log.push('y end'); });
  await Promise.all([a, b]);
  assert.deepEqual(log.slice(0, 2), ['x start', 'y start']);
});
