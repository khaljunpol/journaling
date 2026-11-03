import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastDates, timeSplit } from '../src/overview.ts';

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

test('habitGrid: sorts by 30-day rate and gives week rates', async () => {
  const { habitGrid } = await import('../src/overview.ts');
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
  const { habitGrid } = await import('../src/overview.ts');
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

test('habitGrid: bad habits sort last and stay out of the week %', async () => {
  const { habitGrid } = await import('../src/overview.ts');
  const days = ['2026-10-27', '2026-10-28'];
  const logs = days.map((date) => ({ date, activityId: 'b', completed: true }));
  const g = habitGrid([{ id: 'b', name: 'Beer' }, { id: 'a', name: 'Gym' }], logs, days);
  assert.deepEqual(g.rows.map((r) => r.name), ['Gym', 'Beer']);
  assert.deepEqual(g.rows.map((r) => r.bad), [false, true]);
  assert.equal(g.week, 0);
});
