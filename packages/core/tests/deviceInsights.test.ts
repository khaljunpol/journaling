import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceInsights } from '../src/deviceInsights.ts';

// 2026-10-31 is a Saturday, so this week starts on Monday 2026-10-26.
const today = '2026-10-31';
const cats = [
  { id: '1', name: 'Sleep', color: '#000' },
  { id: '2', name: 'Work', color: '#000' },
  { id: '3', name: 'Rest', color: '#000' },
];
const base = { today, moods: [], hours: [], logs: [], cats, activeIds: new Set(['a', 'b']) };

test('nothing logged: every answer is empty', () => {
  assert.deepEqual(deviceInsights(base), {
    mood: { avg: null, delta: null },
    sleep: null,
    habits: { rate: 0, streak: 0 },
    time: null,
  });
});

test('mood: this week mean and the change from the same days last week', () => {
  const moods = [
    { date: '2026-10-26', score: 8 },
    { date: '2026-10-27', score: 6 },
    { date: '2026-10-19', score: 5 },
  ];
  assert.deepEqual(deviceInsights({ ...base, moods }).mood, { avg: 7, delta: 2 });
});

test('sleep: nights this week, evening hours count for the next day', () => {
  const hours = [
    { date: '2026-10-26', hour: 23, category: 1 },
    { date: '2026-10-27', hour: 0, category: 1 },
    { date: '2026-10-27', hour: 1, category: 1 },
  ];
  assert.equal(deviceInsights({ ...base, hours }).sleep, 3);
});

test('sleep: no sleep category gives null', () => {
  assert.equal(deviceInsights({ ...base, cats: [cats[1]] }).sleep, null);
});

test('habits: 14-day percent and a streak that started before the 14 days', () => {
  const logs = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-10-${String(31 - i).padStart(2, '0')}`,
    activityId: 'a',
    completed: true,
  }));
  assert.deepEqual(deviceInsights({ ...base, logs }).habits, { rate: 50, streak: 20 });
});

test('time: the top use of time leaves sleep out', () => {
  const hours = [
    ...[0, 1, 2].map((hour) => ({ date: '2026-10-28', hour, category: 1 })),
    ...[9, 10].map((hour) => ({ date: '2026-10-28', hour, category: 2 })),
  ];
  assert.deepEqual(deviceInsights({ ...base, hours }).time, { name: 'Work', hours: 2 });
});
