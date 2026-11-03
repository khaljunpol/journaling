import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earnedBadges, mergeBadges } from '../src/badges.ts';
import { dayPoints, deviceGame, gameState, scoresToLock } from '../src/game.ts';
import { parseScoreRows, scoreRowValues } from '../src/ledger.ts';
import { addDaysISO } from '../src/quickWeek.ts';

const today = '2026-11-03';
const back = (i: number) => addDaysISO(today, -i);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const acts = [{ id: 'a', name: 'Gym' }, { id: 'b', name: 'Read' }, { id: 'x', name: 'Beer' }];
const tpl = { weekday: ['a', 'b'], weekend: ['a', 'b'] };
const done = (i: number, id: string) => ({ date: back(i), activityId: id, completed: true });
const base = { today, activities: acts, templates: tpl, stamps: [], fills: new Set<string>(), locked: new Map(), storedBadges: {}, imported: false };

test('earnedBadges: thresholds', () => {
  assert.deepEqual(earnedBadges({ perfectDays: 0, bestStreakDays: 0, level: 1, rescued: 0 }), []);
  assert.deepEqual(earnedBadges({ perfectDays: 10, bestStreakDays: 7, level: 5, rescued: 10 }).sort(), ['level-5', 'perfect-1', 'perfect-10', 'rescued-10', 'streak-7']);
});

test('mergeBadges never removes, and dates new ones today', () => {
  assert.deepEqual(mergeBadges({ 'perfect-1': '2026-01-01', 'level-5': '2026-02-01' }, ['perfect-1', 'streak-7'], today), { 'perfect-1': '2026-01-01', 'level-5': '2026-02-01', 'streak-7': today });
});

test('gameState: points from the first logged day, perfect days, today', () => {
  const logs = [...range(0, 9).flatMap((i) => [done(i, 'a'), done(i, 'b')]), done(0, 'x')];
  const g = gameState({ ...base, logs });
  assert.equal(g.points, 10 * 45);
  assert.equal(g.perfectDays, 10);
  assert.deepEqual(g.today, { done: 2, total: 2, points: 45, perfect: true });
  assert.equal(g.level, 3); // 450: 150 + 200 = 350 → level 3
  assert.ok(g.badges['perfect-10']);
});

test('gameState: the preview equals the locked result for the same data', () => {
  const logs = range(0, 20).flatMap((i) => [done(i, 'a'), ...(i % 2 ? [done(i, 'b')] : [])]);
  const preview = gameState({ ...base, logs });
  const rows = scoresToLock({ ...base, logs, lockedTo: null }).map((s) => scoreRowValues(s, 'T'));
  const locked = gameState({ ...base, logs, locked: parseScoreRows(rows), imported: true });
  assert.equal(locked.points, preview.points);
  assert.equal(locked.perfectDays, preview.perfectDays);
});

test('gameState: adding a habit after lock leaves locked days the same', () => {
  const logs = range(0, 20).map((i) => done(i, 'a'));
  const two = [{ id: 'a', name: 'Gym' }];
  const rows = scoresToLock({ ...base, activities: two, templates: { weekday: ['a'], weekend: ['a'] }, logs, lockedTo: null }).map((s) => scoreRowValues(s, 'T'));
  const before = gameState({ ...base, activities: two, templates: { weekday: ['a'], weekend: ['a'] }, logs, locked: parseScoreRows(rows), imported: true });
  const after = gameState({ ...base, logs, locked: parseScoreRows(rows), imported: true }); // Read added to the list now
  assert.equal(rows.length, 13);
  // Locked days kept their perfect bonus; only the 8 open days changed.
  assert.equal(before.points - after.points, 8 * 25);
});

test('gameState: a day filled 8+ days late scores 0 even with nothing locked', () => {
  const logs = [done(20, 'a'), done(20, 'b')];
  const stamps = [{ date: back(20), kind: 'habits' as const, at: `${back(5)}T10:00:00.000Z` }];
  assert.equal(gameState({ ...base, logs, stamps }).points, 0);
});

test('gameState: rescued counts days logged 1 to 7 days late', () => {
  const logs = range(0, 20).map((i) => done(i, 'a'));
  const stamps = range(10, 19).map((i) => ({ date: back(i), kind: 'habits' as const, at: `${back(i - 3)}T10:00:00.000Z` }));
  assert.equal(gameState({ ...base, logs, stamps }).rescued, 10);
});

test('deviceGame: exactly the spec keys, top streak from good habits only', () => {
  const logs = range(0, 9).flatMap((i) => [done(i, 'a'), done(i, 'x')]);
  const d = deviceGame(gameState({ ...base, logs }));
  assert.deepEqual(Object.keys(d).sort(), ['level', 'perfectDays', 'points', 'toNext', 'today', 'topStreak']);
  assert.deepEqual(Object.keys(d.today).sort(), ['done', 'total']);
  assert.deepEqual(d.topStreak, { name: 'Gym', days: 10, unit: 'days' });
  assert.equal(deviceGame(gameState({ ...base, logs: [] })).topStreak, null);
});

// ── Final review fixes ──────────────────────────────────────────────────────
test('gameState: a closed day with no row stays 0 after a re-tag (it was locked at 0)', () => {
  const logs = [done(20, 'x'), ...range(0, 3).map((i) => done(i, 'a'))]; // day 20: only Beer (bad) → 0, no row
  const rows = scoresToLock({ ...base, logs, lockedTo: null }).map((s) => scoreRowValues(s, 'T'));
  assert.equal(rows.length, 0);
  const retagged = [{ id: 'a', name: 'Gym' }, { id: 'b', name: 'Read' }, { id: 'x', name: 'Beer', category: 'wellbeing' as const }];
  const g = gameState({ ...base, activities: retagged, logs, locked: parseScoreRows(rows), imported: true, lockedTo: back(8) });
  const live = gameState({ ...base, activities: retagged, logs, locked: parseScoreRows(rows), imported: false, lockedTo: null });
  assert.equal(live.points - g.points, 10);
  const pts = dayPoints({ ...base, activities: retagged, logs, locked: parseScoreRows(rows), lockedTo: back(8) }, back(25), today);
  assert.equal(pts.has(back(20)), false);
});
