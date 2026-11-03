import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recapLine, weekRecap } from '../src/weekRecap.ts';

// 2026-11-16 is a Monday, so last week is Monday 2026-11-09 to Sunday 2026-11-15.
const today = '2026-11-16';
const cats = [
  { id: '1', name: 'Sleep', color: '#000' },
  { id: '2', name: 'Work', color: '#000' },
];
const base = { today, moods: [], hours: [], logs: [], cats, activeIds: new Set(['a', 'b']) };

test('nothing logged last week: no recap', () => {
  assert.equal(weekRecap(base), null);
});

test('covers Monday to Sunday of the week before, on any day of this week', () => {
  const moods = [{ date: '2026-11-15', score: 8 }];
  for (const t of ['2026-11-16', '2026-11-19', '2026-11-22']) {
    const r = weekRecap({ ...base, today: t, moods });
    assert.equal(r?.from, '2026-11-09');
    assert.equal(r?.to, '2026-11-15');
  }
});

test('this week is left out', () => {
  assert.equal(weekRecap({ ...base, moods: [{ date: '2026-11-16', score: 8 }] }), null);
});

test('mood: the mean and the change from the full week before', () => {
  const moods = [
    { date: '2026-11-10', score: 8 },
    { date: '2026-11-15', score: 6 },
    { date: '2026-11-02', score: 5 },
  ];
  assert.deepEqual(weekRecap({ ...base, moods })?.mood, { avg: 7, delta: 2 });
});

test('sleep and time: Sunday night counts, sleep stays out of the top use of time', () => {
  const hours = [
    { date: '2026-11-14', hour: 23, category: 1 },
    { date: '2026-11-15', hour: 0, category: 1 },
    { date: '2026-11-15', hour: 9, category: 2 },
    { date: '2026-11-15', hour: 10, category: 2 },
  ];
  const r = weekRecap({ ...base, hours });
  assert.equal(r?.sleep, 2);
  assert.deepEqual(r?.time, { name: 'Work', hours: 2 });
});

test('habits: percent of last week, null when no habit was logged', () => {
  const logs = [{ date: '2026-11-10', activityId: 'a', completed: true }, { date: '2026-11-10', activityId: 'b', completed: true }];
  assert.equal(weekRecap({ ...base, logs })?.habits, Math.round((2 / 14) * 100));
  assert.equal(weekRecap({ ...base, moods: [{ date: '2026-11-10', score: 7 }] })?.habits, null);
});

test('days: on time, late and missed, using stamps', () => {
  const moods = [{ date: '2026-11-09', score: 7 }, { date: '2026-11-10', score: 7 }];
  const stamps = [
    { date: '2026-11-09', kind: 'mood' as const, at: '2026-11-09T18:00:00.000Z' },
    { date: '2026-11-10', kind: 'mood' as const, at: '2026-11-11T18:00:00.000Z' },
  ];
  assert.deepEqual(weekRecap({ ...base, moods, stamps })?.days, { onTime: 1, late: 1, missed: 5 });
});

test('days: null for a week before tracking started', () => {
  const r = weekRecap({ ...base, today: '2026-11-01', moods: [{ date: '2026-10-20', score: 7 }] });
  assert.equal(r?.days, null);
});

test('note: names the best mood day when it stands alone', () => {
  const moods = [
    { date: '2026-11-09', score: 6 },
    { date: '2026-11-11', score: 7 },
    { date: '2026-11-12', score: 9 },
  ];
  assert.deepEqual(weekRecap({ ...base, moods })?.note, { text: 'Thursday was your best day, mood 9', tone: 'good' });
});

test('note: no best day on a tie or with too few moods', () => {
  const tie = [
    { date: '2026-11-09', score: 8 },
    { date: '2026-11-11', score: 8 },
    { date: '2026-11-12', score: 6 },
  ];
  assert.equal(weekRecap({ ...base, moods: tie })?.note, null);
  assert.equal(weekRecap({ ...base, moods: tie.slice(0, 2) })?.note, null);
});

test('note: falls back to the sleep link', () => {
  const moods: Array<{ date: string; score: number }> = [];
  const hours: Array<{ date: string; hour: number; category: number }> = [];
  for (let d = 1; d <= 9; d++) {
    const date = `2026-10-0${d}`;
    moods.push({ date, score: d <= 4 ? 8 : 5 });
    for (let h = 0; h < (d <= 4 ? 8 : 5); h++) hours.push({ date, hour: h, category: 1 });
  }
  for (const date of ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']) {
    moods.push({ date, score: 8 });
    for (let h = 0; h < 8; h++) hours.push({ date, hour: h, category: 1 });
  }
  moods.push({ date: '2026-11-10', score: 8 });
  assert.deepEqual(weekRecap({ ...base, moods, hours })?.note, { text: 'On days after 7h+ sleep, mood is 3 higher', tone: 'good' });
});

test('recapLine: one sentence from what exists', () => {
  assert.equal(
    recapLine({ from: 'a', to: 'b', mood: { avg: 7.2, delta: null }, sleep: null, habits: 80, days: { onTime: 5, late: 1, missed: 1 }, time: null, note: null }),
    'Last week: mood 7.2, habits 80%, 5 of 7 days on time',
  );
  assert.equal(
    recapLine({ from: 'a', to: 'b', mood: { avg: null, delta: null }, sleep: 7.5, habits: null, days: null, time: null, note: null }),
    'Last week: 7.5h sleep',
  );
});

test('days: a late stamp on a day before tracking stays out of the count', () => {
  const moods = [{ date: '2026-10-20', score: 7 }];
  const stamps = [{ date: '2026-10-20', kind: 'mood' as const, at: '2026-10-27T10:00:00.000Z' }];
  assert.equal(weekRecap({ ...base, today: '2026-11-01', moods, stamps })?.days, null);
});
