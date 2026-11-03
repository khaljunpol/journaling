import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitStreaks } from '../src/streaks.ts';
import { addDaysISO } from '../src/quickWeek.ts';

const today = '2026-11-03'; // Tuesday
const back = (i: number) => addDaysISO(today, -i);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const done = (date: string, activityId = 'a') => ({ date, activityId, completed: true });
const acts = [{ id: 'a', name: 'Gym' }, { id: 'x', name: 'Beer' }, { id: 'n', name: 'Read' }];
const daily = { weekday: ['a'], weekend: ['a'] };
const streakOf = (logs: ReturnType<typeof done>[], templates: { weekday: string[] | null; weekend: string[] | null } = daily, t = today) =>
  habitStreaks({ logs, activities: acts, templates, today: t }).find((s) => s.id === 'a');

test('daily: every listed day done counts', () => {
  const s = streakOf(range(0, 4).map((i) => done(back(i))));
  assert.deepEqual([s?.unit, s?.current, s?.best], ['days', 5, 5]);
});

test('daily: today not done yet waits, it never ends the streak', () => {
  assert.equal(streakOf(range(1, 4).map((i) => done(back(i))))?.current, 4);
});

test('daily: an off-list day is skipped, and done anyway adds 1', () => {
  // Weekday-only list. Days 10..4 back = Sat 24 Oct .. Fri 30 Oct.
  const tpl = { weekday: ['a'], weekend: null };
  const weekdays = range(4, 10).filter((i) => ![9, 10, 2, 3].includes(i)); // 9,10 = Sun 25 / Sat 24; 2,3 = Sun 1 / Sat 31
  const s = streakOf([...weekdays, 1, 0].map((i) => done(back(i))), tpl);
  assert.equal(s?.current, weekdays.length + 2);
  const withSat = streakOf([...weekdays, 1, 0, 3].map((i) => done(back(i))), tpl);
  assert.equal(withSat?.current, weekdays.length + 3);
});

test('daily: a miss older than 7 days uses a freeze; it neither adds nor ends', () => {
  const s = streakOf(range(0, 15).filter((i) => i !== 12).map((i) => done(back(i))));
  assert.deepEqual([s?.current, s?.usedFreezes], [15, [back(12)]]);
});

test('daily: a miss inside 7 days waits and uses no freeze; filling it in counts it', () => {
  const missing = streakOf(range(0, 10).filter((i) => i !== 3).map((i) => done(back(i))));
  assert.deepEqual([missing?.current, missing?.usedFreezes.length], [10, 0]);
  assert.equal(streakOf(range(0, 10).map((i) => done(back(i))))?.current, 11);
});

test('daily: out of freezes, the current streak restarts and the best stays', () => {
  // 1 freeze to start: misses at 20 and 17 (only 2 kept between, no new freeze) → the second miss ends it.
  const s = streakOf([...range(21, 23), 19, 18, ...range(9, 16), ...range(0, 8)].map((i) => done(back(i))));
  assert.equal(s?.current, 17);
  assert.equal(s?.best, 17);
  const t = streakOf([...range(21, 30), 19, 18, ...range(0, 16)].map((i) => done(back(i))));
  // 10 kept → +1 freeze (2 total): misses at 20 and 17 both frozen.
  assert.equal(t?.current, 29);
});

test('freezes: earn 1 per 7 kept days, hold at most 2', () => {
  assert.equal(streakOf(range(0, 30).map((i) => done(back(i))))?.freezes, 2);
});

test('weekly: a habit on no list counts weeks, across New Year', () => {
  const t = '2027-01-06'; // Wednesday
  const logs = ['2026-12-22', '2026-12-31', '2027-01-05'].map((d) => done(d));
  const s = streakOf(logs, { weekday: null, weekend: null }, t);
  assert.deepEqual([s?.unit, s?.current], ['weeks', 3]);
});

test('no streak for a bad habit or a habit with no rows', () => {
  const all = habitStreaks({ logs: [done(back(0), 'x'), done(back(0))], activities: acts, templates: daily, today });
  assert.deepEqual(all.map((s) => s.id), ['a']);
});
