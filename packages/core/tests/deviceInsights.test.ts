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
    lines: [],
    yesterdayMissed: false,
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

const texts = (i: { lines: Array<{ text: string; tone: string }> }) => i.lines.map((l) => `${l.tone}: ${l.text}`);

test('lines: a better and a worse mood week read as good and bad', () => {
  const up = [{ date: '2026-10-26', score: 8 }, { date: '2026-10-19', score: 5 }];
  assert.ok(texts(deviceInsights({ ...base, moods: up })).includes('good: Mood is up 3 on last week'));
  const down = [{ date: '2026-10-26', score: 4 }, { date: '2026-10-19', score: 8 }];
  assert.ok(texts(deviceInsights({ ...base, moods: down })).includes('bad: Mood is down 4 on last week'));
});

test('lines: a small mood change says nothing', () => {
  const moods = [{ date: '2026-10-26', score: 7 }, { date: '2026-10-19', score: 6.9 }];
  assert.deepEqual(deviceInsights({ ...base, moods }).lines, []);
});

test('lines: short sleep is bad, enough sleep is good', () => {
  const night = (date: string, n: number) => Array.from({ length: n }, (_, hour) => ({ date, hour, category: 1 }));
  assert.ok(texts(deviceInsights({ ...base, hours: night('2026-10-27', 5) })).includes('bad: Only 5h sleep a night this week'));
  assert.ok(texts(deviceInsights({ ...base, hours: night('2026-10-27', 8) })).includes('good: Sleeping 8h a night this week'));
});

test('lines: mood linked to sleep needs enough days on both sides', () => {
  const nights = Array.from({ length: 12 }, (_, i) => i).flatMap((i) => {
    const date = `2026-10-${String(10 + i).padStart(2, '0')}`;
    return Array.from({ length: i % 2 ? 8 : 5 }, (_, hour) => ({ date, hour, category: 1 }));
  });
  const moods = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, score: i % 2 ? 8 : 6 }));
  assert.equal(deviceInsights({ ...base, hours: nights, moods }).lines[0].text, 'Mood is 2 higher after 7h+ sleep');
  assert.ok(!texts(deviceInsights({ ...base, hours: nights.slice(0, 13), moods: moods.slice(0, 2) })).some((t) => t.includes('higher after')));
});

test('lines: a streak names the best this year', () => {
  const logs = Array.from({ length: 5 }, (_, i) => ({ date: `2026-10-${31 - i}`, activityId: 'a', completed: true }));
  assert.ok(texts(deviceInsights({ ...base, logs })).includes('good: 5-day habit streak, your best this year'));
});

test('lines: weekdays need enough days and a real gap', () => {
  // Mondays 8, Tuesdays 5, three of each.
  const moods = ['2026-10-05', '2026-10-12', '2026-10-19'].flatMap((mon) => {
    const tue = `${mon.slice(0, 8)}${String(Number(mon.slice(8)) + 1).padStart(2, '0')}`;
    return [{ date: mon, score: 8 }, { date: tue, score: 5 }];
  });
  const t = texts(deviceInsights({ ...base, moods }));
  assert.ok(t.includes('good: Mondays are your best mood days'));
  assert.ok(t.includes('neutral: Tuesdays are your lowest mood days'));
});
