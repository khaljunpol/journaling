import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitScoreSeries, lastDates, moodAvg7, stepScore, stripBars, timeSplit, todayFeed, trend } from '../src/lib/overview.ts';
import type { Ctx, DayData } from '../src/lib/quickDay.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('habit score: all done for 10 days rises and stays under 100', () => {
  const days = lastDates('2026-10-27', 10).map((date) => ({ date, done: 4, active: 4 }));
  const s = habitScoreSeries(days);
  assert.equal(s.length, 10);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1]);
  assert.ok(s[9] < 100);
  near(s[0], 5);
});

test('habit score: a missed day after 70 gives 66.5, a perfect day gives 71.5', () => {
  near(stepScore(70, 0), 66.5);
  near(stepScore(70, 1), 71.5);
});

test('habit score: series takes the same step per day', () => {
  const s = habitScoreSeries([
    { date: '2026-10-01', done: 2, active: 2 },
    { date: '2026-10-02', done: 0, active: 2 },
  ]);
  near(s[0], 5);
  near(s[1], 5 * 0.95);
});

test('habit score: days with no active habits are skipped, order does not matter', () => {
  const s = habitScoreSeries([
    { date: '2026-10-03', done: 1, active: 1 },
    { date: '2026-10-01', done: 0, active: 0 },
    { date: '2026-10-02', done: 1, active: 1 },
  ]);
  assert.equal(s.length, 2);
  near(s[0], 5);
  near(s[1], 5 + 0.05 * 95);
  assert.deepEqual(habitScoreSeries([]), []);
});

test('moodAvg7: skips empty days and only reads the 7 days ending today', () => {
  const moods = [
    { date: '2026-10-27', score: 8 },
    { date: '2026-10-25', score: 5 },
    { date: '2026-10-21', score: 5 },
    { date: '2026-10-20', score: 0 }, // outside the window
  ];
  assert.equal(moodAvg7(moods, '2026-10-27'), 6);
  assert.equal(moodAvg7([], '2026-10-27'), null);
  assert.equal(moodAvg7([{ date: '2026-10-01', score: 3 }], '2026-10-27'), null);
});

test('trend: kind wording for up, same and down', () => {
  assert.deepEqual(trend(5, 3), { delta: 2, text: '+2 vs last week' });
  assert.deepEqual(trend(3, 3), { delta: 0, text: 'same as last week' });
  assert.deepEqual(trend(2, 3), { delta: -1, text: '−1 vs last week' });
  assert.equal(trend(6.04, 6).text, 'same as last week');
  assert.equal(trend(6.5, 6).text, '+0.5 vs last week');
});

const ctx: Ctx = {
  activities: [
    { id: 'a', name: 'Read' },
    { id: 'b', name: 'Run' },
    { id: 'c', name: 'Old', status: 'stopped' },
  ],
  categoryIds: [1, 2],
  sidequests: [],
  year: 2026,
};

function day(date: string, over: Partial<DayData> = {}): DayData {
  return { date, mood: null, weight: null, highlight: '', logs: [], hours: Array.from({ length: 24 }, () => null), climbs: 0, sidequestLogIds: [], ...over };
}

test('stripBars: uses the Today rule, missing days are 0 of 0', () => {
  const full = day('2026-10-26', {
    mood: 7,
    weight: 80,
    highlight: 'x',
    logs: [{ activityId: 'a', completed: true }, { activityId: 'b', completed: true }],
    hours: Array.from({ length: 24 }, () => 1),
  });
  const bars = stripBars({ ctx, days: { '2026-10-26': full, '2026-10-27': day('2026-10-27', { mood: 5 }) } }, ['2026-10-25', '2026-10-26', '2026-10-27']);
  assert.deepEqual(bars[0], { date: '2026-10-25', filled: 0, total: 0 });
  assert.equal(bars[1].filled, bars[1].total);
  assert.equal(bars[1].total, 5);
  assert.equal(bars[2].filled, 1);
});

test('todayFeed: card-stack order, only filled items', () => {
  const d = day('2026-10-27', {
    highlight: 'Good run',
    mood: 7,
    weight: 80.5,
    logs: [{ activityId: 'a', completed: true }, { activityId: 'c', completed: true }],
    climbs: 2,
  });
  const feed = todayFeed(d, ctx, []);
  assert.deepEqual(feed.map((f) => f.kind), ['mood', 'habits', 'weight', 'highlight', 'climb']);
  assert.equal(feed[0].text, 'Mood 7/10');
  assert.equal(feed[1].text, 'Habits 1 of 2');
  assert.ok(feed.every((f) => f.state === 'saved'));
});

test('todayFeed: pending and failed come from the outbox keys', () => {
  const d = day('2026-10-27', { mood: 7, weight: 80, highlight: 'ok', logs: [{ activityId: 'a', completed: true }] });
  const feed = todayFeed(d, ctx, [
    { key: 'mood:2026-10-27', state: 'pending' },
    { key: 'log:2026-10-27:a', state: 'failed' },
    { key: 'weight:2026-10-26', state: 'failed' }, // other day, ignored
  ]);
  const by = Object.fromEntries(feed.map((f) => [f.kind, f.state]));
  assert.equal(by.mood, 'pending');
  assert.equal(by.habits, 'failed');
  assert.equal(by.weight, 'saved');
  assert.equal(by.highlight, 'saved');
});

test('timeSplit: counts hours in range, merges the small ones into Other', () => {
  const cats = [1, 2, 3].map((i) => ({ id: String(i), name: `c${i}`, color: '#111' }));
  const entries = [
    { date: '2026-10-20', category: 1 },
    { date: '2026-10-21', category: 1 },
    { date: '2026-10-21', category: 2 },
    { date: '2026-10-21', category: '3' },
    { date: '2026-09-01', category: 3 }, // out of range
  ];
  const r = timeSplit(entries, cats, '2026-10-01', '2026-10-27', 2);
  assert.equal(r.total, 4);
  assert.deepEqual(r.slices.map((s) => [s.name, s.hours]), [['c1', 2], ['c2', 1], ['Other', 1]]);
});

test('lastDates: n dates ending today', () => {
  assert.deepEqual(lastDates('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02']);
});

test('habit score: 60 perfect days from day 1 passes 90', () => {
  const days = lastDates('2026-10-27', 60).map((date) => ({ date, done: 3, active: 3 }));
  const s = habitScoreSeries(days);
  assert.equal(s.length, 60);
  assert.ok(s[59] > 90, String(s[59]));
});

test('habitGrid: sorts by 30-day rate and gives week rates', async () => {
  const { habitGrid } = await import('../src/lib/overview.ts');
  const days = lastDates('2026-10-27', 14);
  const logs = [
    ...days.slice(-7).map((date) => ({ date, activityId: 'a', completed: true })),
    ...days.slice(0, 7).map((date) => ({ date, activityId: 'b', completed: true })),
    { date: days[13], activityId: 'b', completed: false },
  ];
  const g = habitGrid([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], logs, days);
  assert.equal(g.rows.length, 2);
  assert.equal(g.rows[0].rate30, 50);
  assert.equal(g.rows[0].done.filter(Boolean).length, 7);
  assert.equal(g.week, 50);
  assert.equal(g.prevWeek, 50);
});

test('habitGrid: window ends today and fills exactly the logged days', async () => {
  const { habitGrid } = await import('../src/lib/overview.ts');
  const days = lastDates('2026-10-27', 84);
  const logs = [
    { date: '2026-10-27', activityId: 'a', completed: true },
    { date: '2026-10-24', activityId: 'a', completed: true },
    { date: '2026-10-25', activityId: 'a', completed: false },
  ];
  const g = habitGrid([{ id: 'a', name: 'A' }], logs, days);
  assert.equal(days[days.length - 1], '2026-10-27');
  const filled = g.rows[0].done.map((d, i) => (d ? days[i] : null)).filter(Boolean);
  assert.deepEqual(filled, ['2026-10-24', '2026-10-27']);
  assert.equal(g.rows[0].rate30, Math.round((2 / 30) * 100));
});
