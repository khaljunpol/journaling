import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shared } from '../src/lib/shared.ts';

test('shared: calls in a row reuse one request', async () => {
  let n = 0;
  const get = shared(async () => { n += 1; return n; }, 10_000);
  const [a, b] = await Promise.all([get(), get()]);
  assert.deepEqual([a, b, await get(), n], [1, 1, 1, 1]);
});

test('shared: a new request after the time is up, and a failure is not kept', async () => {
  let n = 0;
  let now = 0;
  const get = shared(async () => { n += 1; if (n === 1) throw new Error('x'); return n; }, 1000, () => now);
  await assert.rejects(get());
  assert.equal(await get(), 2);
  now = 2000;
  assert.equal(await get(), 3);
});
