import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerCell, yearDays, yearSummary, type DayTuple } from '../src/yearDays.ts';
import { moodColor } from '../src/mood.ts';
import type { InsightInput } from '../src/insights.ts';

const activities = [{ id: 'g', name: 'Gym' }, { id: 'r', name: 'Read' }, { id: 'b', name: 'Beer' }];
const cats = [{ id: '0', name: 'Sleep', color: '#00f' }];
const base = (p: Partial<InsightInput>): InsightInput => ({ today: '2026-11-03', moods: [], hours: [], logs: [], activities, cats, ...p });
const log = (date: string, activityId: string, completed = true) => ({ date, activityId, completed });

test('yearDays: habit share uses good habits and logged days only', () => {
  const d = yearDays(2026, base({ logs: [log('2026-06-01', 'g'), log('2026-06-01', 'r', false), log('2026-06-01', 'b')] }));
  assert.equal(d['2026-06-01'][1], 0.5);
  assert.equal(d['2026-06-02'], undefined);
});

test('yearDays: the night ending 1 Jan uses 31 Dec evening hours', () => {
  const hours = [22, 23].map((hour) => ({ date: '2025-12-31', hour, category: '0' }))
    .concat([0, 1, 2, 3, 4, 5, 6].map((hour) => ({ date: '2026-01-01', hour, category: '0' })));
  assert.equal(yearDays(2026, base({ hours }))['2026-01-01'][2], 9);
});

test('yearDays: other years, future dates and unknown habits are left out', () => {
  const d = yearDays(2026, base({
    moods: [{ date: '2025-12-30', score: 7 }, { date: '2026-11-04', score: 7 }, { date: '2026-03-03', score: 'x' }],
    logs: [log('2026-04-04', 'zz')],
  }));
  assert.deepEqual(Object.keys(d), []);
});

test('yearSummary: logged counts days with mood or habit rows, best month needs 4+ moods', () => {
  const days: Record<string, DayTuple> = {
    '2026-06-01': [9, null, null, null], '2026-06-02': [9, null, null, null], '2026-06-03': [9, null, null, null],
    '2026-07-01': [7, null, null, null], '2026-07-02': [7, null, null, null], '2026-07-03': [7, null, null, null], '2026-07-04': [7, null, null, null],
    '2026-08-01': [null, 0.5, null, null], '2026-08-02': [null, null, 8, null],
  };
  assert.deepEqual(yearSummary(days), { logged: 8, bestMonth: 6 });
});

test('layerCell: habits steps by share', () => {
  const at = (s: number) => layerCell('habits', '2026-06-01', [null, s, null, null]);
  assert.equal(at(0.1)?.color, 'color-mix(in srgb, var(--accent) 25%, var(--surface-3))');
  assert.equal(at(0.4)?.color, 'color-mix(in srgb, var(--accent) 50%, var(--surface-3))');
  assert.equal(at(0.6)?.color, 'color-mix(in srgb, var(--accent) 75%, var(--surface-3))');
  assert.equal(at(1)?.color, 'color-mix(in srgb, var(--accent) 100%, var(--surface-3))');
  assert.equal(at(0.6)?.label, '2026-06-01: 60% of habits');
  assert.equal(layerCell('habits', '2026-06-01', [7, null, null, null]), null);
});

test('layerCell: sleep steps under 6, 6-7, 7-8, 8+', () => {
  const at = (h: number) => layerCell('sleep', '2026-06-01', [null, null, h, null])?.color;
  assert.deepEqual([at(5), at(6), at(7.5), at(8)], [25, 50, 75, 100].map((n) => `color-mix(in srgb, #38BDF8 ${n}%, var(--surface-3))`));
  assert.equal(layerCell('sleep', '2026-06-01', [null, null, 7.5, null])?.label, '2026-06-01: 7h 30m sleep');
});

test('layerCell: mood uses moodColor; no points means no cell', () => {
  assert.equal(layerCell('mood', '2026-06-01', [8, null, null, null])?.color, moodColor(8));
  assert.equal(layerCell('points', '2026-06-01', [8, 1, 8, null]), null);
  assert.equal(layerCell('mood', '2026-06-01', undefined), null);
});

test('yearDays: share counts only habits that existed that day', () => {
  // Gym first appears on 06-10; on 06-01 only Read existed and was done.
  const d = yearDays(2026, base({ logs: [log('2026-06-01', 'r'), log('2026-06-10', 'g'), log('2026-06-10', 'r', false)] }));
  assert.equal(d['2026-06-01'][1], 1);
  assert.equal(d['2026-06-10'][1], 0.5);
});

test('layerCell: points steps by share of 125, perfect days solid reward', () => {
  const at = (p: number, perfect = false) => layerCell('points', '2026-06-01', [null, null, null, p, perfect]);
  assert.equal(at(30)?.color, 'color-mix(in srgb, var(--accent) 25%, var(--surface-3))');
  assert.equal(at(70)?.color, 'color-mix(in srgb, var(--accent) 75%, var(--surface-3))');
  assert.equal(at(55, true)?.color, 'var(--reward)');
  assert.equal(at(55, true)?.label, '2026-06-01: perfect day, 55 points');
  assert.equal(at(30)?.label, '2026-06-01: 30 points');
  assert.equal(at(0), null);
});

test('yearDays: points from the given map', () => {
  const d = yearDays(2026, base({ logs: [log('2026-06-01', 'g')] }), new Map([['2026-06-01', { points: 35, perfect: true }], ['2026-06-05', { points: 10, perfect: false }]]));
  assert.deepEqual(d['2026-06-01'].slice(3), [35, true]);
  assert.deepEqual(d['2026-06-05'].slice(3), [10, false]);
});
