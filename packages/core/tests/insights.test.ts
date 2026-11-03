import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitsGo, insightLine, insights, lifts, nextDay, rankFindings, weekRhythm, type Finding, type InsightInput } from '../src/insights.ts';
import { moodSplit, type HabitLog, type HourRow, type MoodRow } from '../src/overviewStats.ts';
import { addDaysISO } from '../src/quickWeek.ts';

const today = '2026-11-03';
const back = (i: number) => addDaysISO(today, -i);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const mood = (i: number, score: number): MoodRow => ({ date: back(i), score });
const done = (i: number, activityId: string): HabitLog => ({ date: back(i), activityId, completed: true });
const hrs = (i: number, from: number, to: number, category: string): HourRow[] =>
  range(from, to).map((hour) => ({ date: back(i), hour, category }));

const activities = [
  { id: 'g', name: 'Gym' },
  { id: 'r', name: 'Read' },
  { id: 'b', name: 'Beer' },
];
const cats = [
  { id: '0', name: 'Sleep', color: '#00f' },
  { id: '1', name: 'Work', color: '#f90' },
];
const input = (p: Partial<InsightInput>): InsightInput => ({ today, moods: [], hours: [], logs: [], activities, cats, ...p });
const brief = (fs: Finding[]) => fs.map((f) => [f.kind, f.name, f.gap]);

test('moodSplit keeps 10/3 by default and takes new minimums', () => {
  const moods = [...range(1, 8).map((i) => mood(i, 8)), ...range(9, 12).map((i) => mood(i, 6))];
  const side = new Map(range(1, 12).map((i) => [back(i), i <= 8]));
  assert.ok(moodSplit(moods, side, today));
  assert.equal(moodSplit(moods, side, today, { pairs: 14, side: 5 }), null);
});

test('lifts: a habit with a big steady gap is found', () => {
  const r = lifts(input({
    moods: [...range(1, 10).map((i) => mood(i, 6)), ...range(11, 20).map((i) => mood(i, 8))],
    logs: [...range(11, 20).map((i) => done(i, 'g')), ...range(1, 20).map((i) => done(i, 'r'))],
  }));
  assert.deepEqual(brief(r), [['habit', 'Gym', 2]]);
});

test('lifts: blank days are left out of habit sides', () => {
  const r = lifts(input({
    moods: [...range(1, 10).map((i) => mood(i, 8)), ...range(11, 34).map((i) => mood(i, 6))],
    logs: [...range(1, 10).map((i) => done(i, 'g')), ...range(11, 14).map((i) => done(i, 'r'))],
  }));
  assert.deepEqual(r, []);
});

test('lifts: a gap under 0.5 is not said', () => {
  const r = lifts(input({
    moods: [...range(1, 4).map((i) => mood(i, 7)), ...range(5, 10).map((i) => mood(i, 6)), ...range(11, 20).map((i) => mood(i, 6))],
    logs: [...range(1, 10).map((i) => done(i, 'g')), ...range(1, 20).map((i) => done(i, 'r'))],
  }));
  assert.deepEqual(r, []);
});

test('lifts: a noisy gap under 2 standard errors is not said', () => {
  const r = lifts(input({
    moods: [...range(1, 10).map((i) => mood(i, i % 2 ? 2 : 10)), ...range(11, 20).map((i) => mood(i, i % 2 ? 3 : 8))],
    logs: [...range(1, 10).map((i) => done(i, 'g')), ...range(1, 20).map((i) => done(i, 'r'))],
  }));
  assert.deepEqual(r, []);
});

test('lifts: sleep 7h+ vs under, inside the 180-day window only', () => {
  const sleepRows = (offset: number) => [
    ...range(1, 10).flatMap((i) => hrs(i + offset, 0, 7, '0')),
    ...range(11, 20).flatMap((i) => hrs(i + offset, 0, 4, '0')),
  ];
  const moodsAt = (offset: number) => [...range(1, 10).map((i) => mood(i + offset, 8)), ...range(11, 20).map((i) => mood(i + offset, 6))];
  assert.deepEqual(brief(lifts(input({ moods: moodsAt(0), hours: sleepRows(0) }))), [['sleep', '7h+ sleep', 2]]);
  assert.deepEqual(lifts(input({ moods: moodsAt(200), hours: sleepRows(200) })), []);
});

test('lifts: time sides split at the median, need 20+ hours a day, and leave sleep out', () => {
  // Hours 0..11 are always sleep, so every night is long and sleep never splits.
  const day = (i: number, work: number) => [...hrs(i, 0, 11, '0'), ...hrs(i, 12, 11 + work, '1'), ...hrs(i, 12 + work, 23, '0')];
  const hours = [...range(1, 8).flatMap((i) => day(i, 8)), ...range(9, 16).flatMap((i) => day(i, 2))];
  const moods = [...range(1, 8).map((i) => mood(i, 8)), ...range(9, 16).map((i) => mood(i, 6))];
  const r = lifts(input({ moods, hours }));
  assert.deepEqual(brief(r), [['time', 'Work', 2]]);
  assert.equal(r[0].cut, 5);
  const workOnly = hours.filter((h) => h.category === '1');
  assert.deepEqual(lifts(input({ moods, hours: workOnly })), []);
});

test('lifts: a bad habit is found and marked bad', () => {
  const r = lifts(input({
    moods: [...range(1, 10).map((i) => mood(i, 6)), ...range(11, 20).map((i) => mood(i, 5))],
    logs: [...range(11, 20).map((i) => done(i, 'b')), ...range(1, 20).map((i) => done(i, 'r'))],
  }));
  assert.deepEqual(brief(r), [['habit', 'Beer', -1]]);
  assert.equal(r[0].bad, true);
});

test('lifts: unknown habit ids and future rows are ignored', () => {
  const r = lifts(input({
    moods: [...range(1, 10).map((i) => mood(i, 8)), ...range(11, 20).map((i) => mood(i, 6)), ...range(1, 10).map((i) => mood(-i, 10))],
    logs: [...range(1, 10).map((i) => done(i, 'zz')), ...range(1, 20).map((i) => done(i, 'r')), ...range(1, 10).map((i) => done(-i, 'g')), ...range(1, 20).map((i) => done(i, 'r'))],
  }));
  assert.deepEqual(r, []);
});

test('rankFindings: biggest gap first, ties by more days', () => {
  const f = (name: string, gap: number, n: number): Finding => ({ kind: 'habit', id: name, name, hi: 0, lo: 0, nHi: n, nLo: n, gap });
  assert.deepEqual(rankFindings([f('a', 0.6, 5), f('b', -1.2, 5), f('c', 0.6, 9)]).map((x) => x.name), ['b', 'c', 'a']);
});

test('nextDay: a habit on D pairs with mood on D+1, and sleep never appears', () => {
  const sleep = range(1, 22).flatMap((i) => hrs(i, 0, i % 2 ? 8 : 3, '0'));
  const r = nextDay(input({
    moods: [...range(1, 10).map((i) => mood(i, 6)), ...range(11, 20).map((i) => mood(i, 8))],
    logs: [...range(12, 21).map((i) => done(i, 'g')), ...range(2, 21).map((i) => done(i, 'r'))],
    hours: sleep,
  }));
  assert.deepEqual(r.map((f) => [f.kind, f.name]), [['habit', 'Gym']]);
});

// ── Task 2 ──────────────────────────────────────────────────────────────────
// today 2026-11-03 is a Tuesday: this week = Mon 11-02 and Tue 11-03.
const acts2 = [
  { id: 'g', name: 'Gym' },            // move
  { id: 'r', name: 'Read' },           // mind
  { id: 'b', name: 'Beer' },           // bad
];

test('habitsGo: hidden under 20 checks or inside one week', () => {
  assert.equal(habitsGo(input({ activities: acts2, logs: range(0, 18).map((i) => done(i, 'g')) })), null);
  const many = range(0, 11).map((k) => ({ id: `h${k}`, name: `Gym ${k}` }));
  assert.equal(habitsGo(input({ activities: many, logs: [0, 1].flatMap((i) => many.map((h) => done(i, h.id))) })), null);
});

test('habitsGo: top category share and delta on the 4 weeks before', () => {
  const logs = [
    ...range(0, 5).map((i) => done(i, 'g')), ...range(0, 3).map((i) => done(i, 'r')),          // last 4 weeks: Move 6, Mind 4
    ...range(28, 32).map((i) => done(i, 'g')), ...range(28, 32).map((i) => done(i, 'r')),      // before: 5 / 5
    ...range(60, 67).map((i) => done(i, 'g')),                                                  // older, inside 12 weeks
  ];
  const r = habitsGo(input({ activities: acts2, logs }));
  assert.ok(r);
  assert.deepEqual(r.top, { category: 'move', pct: 60, delta: 10 });
  assert.equal(r.weeks.length, 12);
  assert.equal(r.weeks[11].from, '2026-11-02');
  assert.deepEqual(r.byCategory.map((c) => [c.category, c.habits.map((h) => [h.name, h.done])]), [['move', [['Gym', 6]]], ['mind', [['Read', 4]]]]);
});

test('habitsGo: delta is null with no checks in the 4 weeks before', () => {
  const logs = [...range(0, 13).map((i) => done(i, 'g')), ...range(14, 20).map((i) => done(i, 'r'))];
  assert.equal(habitsGo(input({ activities: acts2, logs }))?.top.delta, null);
});

test('habitsGo: bad habits stay out of bars and shares, and show as day counts', () => {
  const logs = [...range(0, 20).map((i) => done(i, 'g')), done(0, 'b'), done(1, 'b'), done(3, 'b')];
  const r = habitsGo(input({ activities: acts2, logs }));
  assert.ok(r);
  assert.equal(r.top.pct, 100);
  assert.deepEqual(r.bad, { thisWeek: 2, lastWeek: 1 });
  assert.equal(Object.hasOwn(r.weeks[11].counts, 'bad'), false);
  assert.equal(habitsGo(input({ activities: acts2.slice(0, 2), logs }))?.bad, null);
});

test('weekRhythm: needs 4+ moods on both named days and a gap of 1', () => {
  // Weekdays by i back from Tue 11-03: i=3 Sat, i=1 Mon.
  const sats = range(0, 3).map((w) => mood(3 + 7 * w, 9));
  const mons = range(0, 3).map((w) => mood(1 + 7 * w, 6));
  const r = weekRhythm(input({ moods: [...sats, ...mons] }));
  assert.ok(r);
  assert.deepEqual([r.best.day, r.low.day], ['Saturday', 'Monday']);
  assert.equal(weekRhythm(input({ moods: [...sats, ...mons.slice(0, 3)] })), null);
  assert.equal(weekRhythm(input({ moods: [...sats.map((m) => ({ ...m, score: 6.5 })), ...mons] })), null);
});

test('weekRhythm: habit % per weekday uses logged days only', () => {
  const sats = range(0, 3).map((w) => mood(3 + 7 * w, 9));
  const mons = range(0, 3).map((w) => mood(1 + 7 * w, 6));
  // Two Mondays logged: Gym done once of two good habits each → 50%. Other Mondays blank.
  const r = weekRhythm(input({ activities: acts2, moods: [...sats, ...mons], logs: [done(1, 'g'), done(8, 'g'), { date: back(1), activityId: 'r', completed: false }, { date: back(8), activityId: 'r', completed: false }] }));
  assert.equal(r?.habits.find((d) => d.day === 'Monday')?.pct, 50);
  assert.equal(r?.habits.find((d) => d.day === 'Saturday')?.pct, null);
});

test('insights: no mood hides the mood answers, keeps habitsGo, and asks for 14 days', () => {
  const r = insights(input({ activities: acts2, logs: range(0, 20).map((i) => done(i, 'g')) }));
  assert.deepEqual([r.lifts, r.nextDay, r.rhythm], [[], [], null]);
  assert.ok(r.habitsGo);
  assert.equal(r.moreDays, 14);
});

test('insights: moreDays counts mood days left to 14', () => {
  assert.equal(insights(input({ moods: range(1, 9).map((i) => mood(i, 6)) })).moreDays, 5);
});

test('insightLine copy', () => {
  const f = (p: Partial<Finding>): Finding => ({ kind: 'habit', id: 'x', name: 'Gym', hi: 0, lo: 0, nHi: 5, nLo: 5, gap: 1.2, ...p });
  assert.equal(insightLine(f({})), 'On days when Gym is done, mood is 1.2 higher');
  assert.equal(insightLine(f({ name: 'Beer', gap: -0.8, bad: true })), 'On days when Beer is done, mood is 0.8 lower');
  assert.equal(insightLine(f({ kind: 'sleep', name: '7h+ sleep', gap: 0.9 })), 'On days after 7h+ sleep, mood is 0.9 higher');
  assert.equal(insightLine(f({ kind: 'time', name: 'Work', cut: 5, gap: -0.7 })), 'On days with 5h+ Work, mood is 0.7 lower');
  assert.equal(insightLine(f({ gap: 0.6 }), true), 'The day after Gym, mood is 0.6 higher');
});

// ── Final review fixes ──────────────────────────────────────────────────────
test('lifts: a new habit is not compared with days before it existed', () => {
  // Read logged 60 days; Gym added 10 days ago, 6 ticks; mood rises on its own.
  const moods = range(1, 60).map((i) => mood(i, i <= 10 ? 8 : 6.6));
  const logs = [...range(1, 60).map((i) => done(i, 'r')), ...range(1, 6).map((i) => done(i, 'g')), ...range(7, 10).map((i) => ({ date: back(i), activityId: 'g', completed: false }))];
  assert.equal(lifts(input({ moods, logs })).some((f) => f.name === 'Gym'), false);
});

test('weekRhythm: a habit added later does not lower the % of older days', () => {
  const sats = range(0, 3).map((w) => mood(3 + 7 * w, 9));
  const mons = range(0, 3).map((w) => mood(1 + 7 * w, 6));
  // Read done on all four Mondays; Gym first appears on the last Monday (i=1) and is done there.
  const logs = [...[1, 8, 15, 22].map((i) => done(i, 'r')), done(1, 'g')];
  assert.equal(weekRhythm(input({ activities: acts2, moods: [...sats, ...mons], logs }))?.habits.find((d) => d.day === 'Monday')?.pct, 100);
});
