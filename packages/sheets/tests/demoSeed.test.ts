import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoSeed } from '../src/demoSeed.ts';
import { HEADERS, TABS, type TabKey } from '../src/sheetLayout.ts';
import { weeklyMoods } from '@journaling/core/overviewStats';

const TODAY = '2026-06-15';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dayDiff = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 86400000;
const rowsOf = (seed: Record<string, string[][]>, key: TabKey) => seed[TABS[key]].slice(1);

test('every core tab exists with its header', () => {
  const seed = demoSeed(TODAY);
  for (const key of Object.keys(TABS) as TabKey[]) {
    assert.ok(seed[TABS[key]], `missing tab ${TABS[key]}`);
    assert.deepEqual(seed[TABS[key]][0], HEADERS[key]);
  }
});

test('all dates are on or before today and within 190 days', () => {
  const seed = demoSeed(TODAY);
  const dated: TabKey[] = ['logs', 'highlights', 'weights', 'moods', 'hours', 'dayLogs', 'dayScores'];
  for (const key of dated) {
    for (const r of rowsOf(seed, key)) {
      assert.match(r[0], DATE);
      assert.ok(r[0] <= TODAY, `${key} ${r[0]} is after today`);
      assert.ok(dayDiff(TODAY, r[0]) <= 190, `${key} ${r[0]} is too old`);
    }
  }
  for (const r of rowsOf(seed, 'climbs')) {
    assert.match(r[1], DATE);
    assert.ok(r[1] <= TODAY && dayDiff(TODAY, r[1]) <= 190);
  }
  for (const r of rowsOf(seed, 'sidequestLogs')) {
    assert.ok(r[2] <= TODAY && dayDiff(TODAY, r[2]) <= 190);
  }
});

test('today is left empty so a visitor can log it', () => {
  const seed = demoSeed(TODAY);
  for (const key of ['logs', 'highlights', 'weights', 'moods', 'hours'] as TabKey[]) {
    assert.ok(!rowsOf(seed, key).some((r) => r[0] === TODAY), `${key} has a row for today`);
  }
  assert.ok(!rowsOf(seed, 'climbs').some((r) => r[1] === TODAY), 'climbs has a row for today');
  assert.ok(rowsOf(seed, 'moods').some((r) => r[0] === '2026-06-14'), 'yesterday should still be logged');
});

test('same today gives identical output', () => {
  assert.deepEqual(demoSeed(TODAY), demoSeed(TODAY));
  assert.notDeepEqual(demoSeed(TODAY), demoSeed('2026-06-16'));
});

test('has a hard week followed by a better week', () => {
  const seed = demoSeed(TODAY);
  const moods = rowsOf(seed, 'moods').map(([date, score]) => ({ date, score }));
  const weeks = [...weeklyMoods(moods, TODAY)].sort(([a], [b]) => a.localeCompare(b));
  const found = weeks.some(([, v], i) => v < 5 && i + 1 < weeks.length && weeks[i + 1][1] >= v + 1.5);
  assert.ok(found, 'no hard week followed by a better one');
  assert.equal(rowsOf(seed, 'moods').length >= 175, true);
});

test('activity ids in logs exist in Activities', () => {
  const seed = demoSeed(TODAY);
  const ids = new Set(rowsOf(seed, 'activities').map((r) => r[0]));
  assert.equal(ids.size, 6);
  const logs = rowsOf(seed, 'logs');
  assert.ok(logs.length > 300);
  for (const r of logs) assert.ok(ids.has(r[1]), `unknown activity ${r[1]}`);
});

test('formats match what the readers parse', () => {
  const seed = demoSeed(TODAY);
  for (const r of rowsOf(seed, 'logs')) assert.ok(r[2] === '1' || r[2] === '0');
  for (const r of rowsOf(seed, 'moods')) assert.match(r[1], /^\d+$/);
  for (const r of rowsOf(seed, 'weights')) assert.ok(Number.isFinite(parseFloat(r[1])));
  const catIds = new Set(rowsOf(seed, 'timeCategories').map((r) => r[0]));
  assert.ok(catIds.size >= 4 && catIds.size <= 5);
  assert.ok(rowsOf(seed, 'timeCategories').some((r) => r[4] === 'sleep'));
  for (const r of rowsOf(seed, 'hours')) {
    assert.equal(r.length, 25);
    for (const c of r.slice(1)) assert.ok(c === '' || catIds.has(c));
  }
  assert.equal(rowsOf(seed, 'sidequests').length, 2);
  for (const r of rowsOf(seed, 'sidequests')) if (r[6]) assert.ok(Array.isArray(JSON.parse(r[6])));
  const sqIds = new Set(rowsOf(seed, 'sidequests').map((r) => r[0]));
  for (const r of rowsOf(seed, 'sidequestLogs')) assert.ok(sqIds.has(r[1]));
  assert.equal(rowsOf(seed, 'climbGoals').length, 1);
  assert.equal(rowsOf(seed, 'climbGoals')[0][1], TODAY.slice(0, 4));
  const settings = Object.fromEntries(rowsOf(seed, 'settings').map((r) => [r[0], r[1]]));
  assert.equal(settings.gameImported, '1');
  assert.equal(settings.ownerEmail, '');
});
