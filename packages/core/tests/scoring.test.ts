import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, rewardFor, scoreDay, usualList } from '../src/scoring.ts';

// 2026-11-03 is a Tuesday (weekday); 2026-11-07 is a Saturday.
const acts = [
  { id: 'a', name: 'Gym' }, { id: 'b', name: 'Read' }, { id: 'c', name: 'Yoga' }, { id: 'x', name: 'Beer' },
];
const none = { weekday: null, weekend: null };
const log = (date: string, activityId: string, completed = true) => ({ date, activityId, completed });
const day = (p: Partial<Parameters<typeof scoreDay>[0]>) =>
  scoreDay({ date: '2026-11-03', logs: [], activities: acts, templates: none, firstHabitStamp: null, filled: false, ...p });

test('scoreDay: +10 per good habit once, bad habits 0', () => {
  const s = day({ logs: [log('2026-11-03', 'a'), log('2026-11-03', 'a'), log('2026-11-03', 'x')] });
  assert.equal(s.points, 10);
  assert.equal(s.byCat.move, 10);
});

test('scoreDay: cap at 10 habits, max 125', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, name: `Gym ${i}` }));
  const s = scoreDay({ date: '2026-11-03', logs: many.map((h) => log('2026-11-03', h.id)), activities: many, templates: none, firstHabitStamp: null, filled: false });
  assert.equal(s.points, 125);
  assert.equal(s.perfect, true);
});

test('scoreDay: perfect uses the day type usual list, off-list ticks still earn', () => {
  const templates = { weekday: ['a', 'b'], weekend: ['c'] };
  const s = day({ templates, logs: [log('2026-11-03', 'a'), log('2026-11-03', 'b'), log('2026-11-03', 'c')] });
  assert.deepEqual([s.points, s.perfect, s.done, s.total], [55, true, 2, 2]);
  const sat = day({ date: '2026-11-07', templates, logs: [log('2026-11-07', 'a')] });
  assert.deepEqual([sat.points, sat.perfect, sat.done, sat.total], [10, false, 0, 1]);
});

test('scoreDay: an empty or bad-only list falls back to all good habits', () => {
  const s = day({ templates: { weekday: ['x'], weekend: null }, logs: ['a', 'b', 'c'].map((id) => log('2026-11-03', id)) });
  assert.deepEqual([s.perfect, s.total, s.points], [true, 3, 55]);
});

test('scoreDay: a filled day gets no perfect bonus', () => {
  const s = day({ filled: true, logs: ['a', 'b', 'c'].map((id) => log('2026-11-03', id)) });
  assert.deepEqual([s.points, s.perfect], [30, false]);
});

test('scoreDay: 7 days late scores full, 8 days late scores 0', () => {
  const logs = [log('2026-11-03', 'a')];
  assert.equal(day({ logs, firstHabitStamp: '2026-11-10T20:00:00.000Z' }).points, 10); // 10 Nov (UTC)
  assert.equal(day({ logs, firstHabitStamp: '2026-11-11T00:30:00.000Z' }).points, 0); // 11 Nov (UTC)
});

test('scoreDay: no stamp counts as on time; unknown ids earn nothing; other days ignored', () => {
  assert.equal(day({ logs: [log('2026-11-03', 'a'), log('2026-11-03', 'zz'), log('2026-11-04', 'b')] }).points, 10);
});

test('usualList keeps good, existing ids only', () => {
  assert.deepEqual(usualList('2026-11-03', { weekday: ['a', 'x', 'gone'], weekend: null }, acts), ['a']);
});

test('levelFor: costs 50 × (level + 2)', () => {
  const at = (t: number) => levelFor(t).level;
  assert.deepEqual([at(0), at(149), at(150), at(350), at(900), at(3150), at(11400)], [1, 1, 2, 3, 5, 10, 20]);
  assert.deepEqual(levelFor(470), { level: 3, into: 120, toNext: 130, cost: 250 });
});

test('rewardFor: the points a Done adds, and a newly perfect day', () => {
  const templates = { weekday: ['a', 'b'], weekend: null };
  const base = { date: '2026-11-03', today: '2026-11-03', activities: acts, templates, stamps: [] };
  const r = rewardFor({ ...base, before: [log('2026-11-03', 'a')], after: ['a', 'b', 'c'].map((id) => log('2026-11-03', id)) });
  assert.deepEqual(r, { points: 45, perfect: true });
  assert.deepEqual(rewardFor({ ...base, before: ['a', 'b'].map((id) => log('2026-11-03', id)), after: [log('2026-11-03', 'a')] }), { points: -35, perfect: false });
});

test('rewardFor: a first log 8+ days late earns nothing, 7 days late earns full', () => {
  const after = ['a', 'b'].map((id) => log('2026-10-26', id));
  const b = { date: '2026-10-26', activities: acts, templates: { weekday: ['a', 'b'], weekend: null }, stamps: [], before: [] };
  assert.deepEqual(rewardFor({ ...b, today: '2026-11-03', after }), { points: 0, perfect: false });
  assert.deepEqual(rewardFor({ ...b, today: '2026-11-02', after }), { points: 45, perfect: true });
});

test('rewardFor: a day older than 7 days shows no reward (its points are closed)', () => {
  const r = rewardFor({ date: '2026-10-20', today: '2026-11-03', activities: acts, templates: none, stamps: [{ date: '2026-10-20', kind: 'habits', at: '2026-10-20T10:00:00.000Z' }], before: [log('2026-10-20', 'a', false)], after: [log('2026-10-20', 'a')] });
  assert.deepEqual(r, { points: 0, perfect: false });
});
