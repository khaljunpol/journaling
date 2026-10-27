import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTabCache, type RangeReader } from '../src/lib/sheetCache.ts';
import { dataRange } from '../src/lib/sheetLayout.ts';

function setup(opts: { fail?: boolean; gate?: boolean } = {}) {
  const calls: { id: string; ranges: string[] }[] = [];
  const state = { n: 0, fail: !!opts.fail };
  const gates: (() => void)[] = [];
  const reader: RangeReader = {
    async batchGet(id, ranges) {
      calls.push({ id, ranges });
      const n = ++state.n;
      if (opts.gate) await new Promise<void>((r) => gates.push(r));
      if (state.fail) throw new Error('boom');
      return ranges.map((r) => [[`${r}#${n}`]]);
    },
  };
  let t = 1000;
  const clock = { advance: (ms: number) => { t += ms; } };
  return { reader, calls, state, gates, clock, now: () => t };
}

describe('tab cache', () => {
  it('serves within ttl and refetches after', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    await c.readOne('A', 'logs');
    await c.readOne('A', 'logs');
    assert.equal(s.calls.length, 1);
    s.clock.advance(30_001);
    await c.readOne('A', 'logs');
    assert.equal(s.calls.length, 2);
  });

  it('batches all missing tabs in one call', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    const out = await c.read('A', ['logs', 'moods', 'climbs']);
    assert.equal(s.calls.length, 1);
    assert.deepEqual(s.calls[0].ranges, [dataRange('logs'), dataRange('moods'), dataRange('climbs')]);
    assert.deepEqual(out.moods, [[`${dataRange('moods')}#1`]]);
  });

  it('fetches only uncached tabs', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    await c.readOne('A', 'logs');
    await c.read('A', ['logs', 'moods']);
    assert.equal(s.calls.length, 2);
    assert.deepEqual(s.calls[1].ranges, [dataRange('moods')]);
  });

  it('joins concurrent reads', async () => {
    const s = setup({ gate: true });
    const c = createTabCache(s.reader, { now: s.now });
    const a = c.readOne('A', 'logs');
    const b = c.readOne('A', 'logs');
    s.gates.forEach((g) => g());
    await Promise.all([a, b]);
    assert.equal(s.calls.length, 1);
  });

  it('never shares entries between spreadsheets', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    await c.readOne('A', 'logs');
    await c.readOne('B', 'logs');
    assert.equal(s.calls.length, 2);
    assert.deepEqual(s.calls.map((x) => x.id), ['A', 'B']);
  });

  it('invalidate refetches that tab only', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    await c.read('A', ['logs', 'moods']);
    c.invalidate('A', 'logs');
    await c.read('A', ['logs', 'moods']);
    assert.equal(s.calls.length, 2);
    assert.deepEqual(s.calls[1].ranges, [dataRange('logs')]);
  });

  it('a stale in-flight fetch is returned but not stored', async () => {
    const s = setup({ gate: true });
    const c = createTabCache(s.reader, { now: s.now });
    const first = c.readOne('A', 'logs');
    c.invalidate('A', 'logs');
    s.gates.shift()!();
    const old = await first;
    assert.deepEqual(old, [[`${dataRange('logs')}#1`]]);
    const second = c.readOne('A', 'logs');
    s.gates.shift()!();
    assert.deepEqual(await second, [[`${dataRange('logs')}#2`]]);
    assert.equal(s.calls.length, 2);
  });

  it('does not cache failures', async () => {
    const s = setup({ fail: true });
    const c = createTabCache(s.reader, { now: s.now });
    await assert.rejects(c.readOne('A', 'logs'));
    s.state.fail = false;
    await c.readOne('A', 'logs');
    assert.equal(s.calls.length, 2);
  });

  it('returns frozen rows so callers cannot mutate the cache', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    const rows = await c.readOne('A', 'logs');
    assert.throws(() => { (rows as string[][]).push(['x']); });
    assert.throws(() => { rows[0].push('x'); });
  });

  it('clear drops everything', async () => {
    const s = setup();
    const c = createTabCache(s.reader, { now: s.now });
    await c.readOne('A', 'logs');
    c.clear();
    await c.readOne('A', 'logs');
    assert.equal(s.calls.length, 2);
  });
});
