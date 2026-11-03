import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameSettings, parseFillDates, parseWorldPlants } from '../src/lib/server/gameInput.ts';

test('gameSettings reads templates, cursor, import flag and badges; junk is safe', () => {
  const s = gameSettings({
    habitTemplateWeekday: '["a","b"]', habitTemplateWeekend: 'nope',
    scoresLockedTo: '2026-10-26', gameImported: '1', badges: '{"perfect-1":"2026-01-01","bogus":"x"}',
  });
  assert.deepEqual(s, { templates: { weekday: ['a', 'b'], weekend: null }, lockedTo: '2026-10-26', imported: true, badges: { 'perfect-1': '2026-01-01' } });
  assert.deepEqual(gameSettings({ scoresLockedTo: 'yesterday' }), { templates: { weekday: null, weekend: null }, lockedTo: null, imported: false, badges: {} });
});

test('parseFillDates: valid dates only, at most 31, else null', () => {
  assert.deepEqual(parseFillDates(['2026-11-01', '2026-11-02']), ['2026-11-01', '2026-11-02']);
  assert.equal(parseFillDates(['2026-11-01', 'x']), null);
  assert.equal(parseFillDates('2026-11-01'), null);
  assert.equal(parseFillDates(Array.from({ length: 32 }, () => '2026-11-01')), null);
});

test('parseWorldPlants keeps valid records only', () => {
  assert.deepEqual(parseWorldPlants('{"a":{"slot":0,"kind":"tree","name":"Gym"},"b":{"slot":"x","kind":"tree","name":"B"},"c":{"slot":1,"kind":"rock","name":"C"}}'), { a: { slot: 0, kind: 'tree', name: 'Gym' } });
  assert.deepEqual(parseWorldPlants('nope'), {});
  assert.deepEqual(parseWorldPlants(undefined), {});
});
