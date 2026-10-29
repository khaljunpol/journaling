import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  avgKnown, bestStreak, climbWeek, dailySeries, findSleepIds, habitDays, habitRate, habitStreak, hm, lastHighlight,
  daySpan, monthAgo, moodSplit, moodWeek, sleepNights, timeCompare, weekWindow,
  type Cat, type HabitLog, type HourRow, type MoodRow,
} from '../src/lib/overviewStats.ts';

const TODAY = '2026-10-28'; // Wednesday; week starts Mon 2026-10-26
const cats: Cat[] = [
  { id: '0', name: 'sleep', color: '#00f' },
  { id: '1', name: 'work', color: '#f90' },
  { id: '2', name: 'friends', color: '#0f0' },
];
const hours = (date: string, from: number, to: number, category: number | string): HourRow[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ date, hour: from + i, category }));

describe('weekWindow, hm, monthAgo', () => {
  it('weekWindow on a Wednesday', () => {
    assert.deepEqual(weekWindow('2026-10-28'), { from: '2026-10-26', to: '2026-10-28', prevFrom: '2026-10-19', prevTo: '2026-10-21' });
  });
  it('weekWindow on a Monday is one day vs one day', () => {
    assert.deepEqual(weekWindow('2026-10-26'), { from: '2026-10-26', to: '2026-10-26', prevFrom: '2026-10-19', prevTo: '2026-10-19' });
  });
  it('hm', () => {
    assert.equal(hm(7.1667), '7h 10m');
    assert.equal(hm(22), '22h');
    assert.equal(hm(0), '0h');
  });
  it('monthAgo clamps to month end', () => {
    assert.equal(monthAgo('2026-03-31'), '2026-02-28');
    assert.equal(monthAgo('2028-03-31'), '2028-02-29');
    assert.equal(monthAgo('2026-01-15'), '2025-12-15');
    assert.equal(monthAgo('2026-10-28'), '2026-09-28');
  });
});

describe('moods', () => {
  it('moodWeek with no rows', () => {
    assert.deepEqual(moodWeek([], TODAY), { avg: null, prevAvg: null, days: 0 });
  });
  it('moodWeek compares same weekdays and ignores future rows', () => {
    const rows: MoodRow[] = [
      { date: '2026-10-26', score: 4 }, { date: '2026-10-28', score: '5' },
      { date: '2026-10-29', score: 1 }, // future
      { date: '2026-10-19', score: 2 }, { date: '2026-10-21', score: 3 },
      { date: '2026-10-22', score: 1 }, // last Thu: outside the same-days window
    ];
    assert.deepEqual(moodWeek(rows, TODAY), { avg: 4.5, prevAvg: 2.5, days: 2 });
  });
  it('moodWeek averages per-day means', () => {
    const rows: MoodRow[] = [{ date: '2026-10-26', score: 1 }, { date: '2026-10-26', score: 1 }, { date: '2026-10-26', score: 1 }, { date: '2026-10-27', score: 5 }];
    assert.equal(moodWeek(rows, TODAY).avg, 3);
  });
  it('weekWindow crosses the year', () => {
    assert.deepEqual(weekWindow('2026-01-01'), { from: '2025-12-29', to: '2026-01-01', prevFrom: '2025-12-22', prevTo: '2025-12-25' });
  });
  it('dailySeries crosses the year', () => {
    const s = dailySeries([{ date: '2025-12-31', score: 4 }], '2026-01-02', 14);
    assert.equal(s[0].date, '2025-12-20');
    assert.equal(s[11].value, 4);
  });
  it('brand-new user: empty inputs give null or zero, no NaN', () => {
    assert.equal(moodSplit([], new Map(), TODAY), null);
    assert.equal(habitStreak(habitDays([], new Set(), ['2026-10-27', TODAY]), TODAY), 0);
    assert.equal(avgKnown(sleepNights([], new Set(), [TODAY])), null);
  });
  it('moodSplit drops future days', () => {
    const m = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(i + 20).padStart(2, '0')}`, score: 3 }));
    const f = new Map(m.map((r, i) => [r.date, i < 6] as const));
    assert.equal(moodSplit(m, f, TODAY), null); // only 20..28 = 9 pairs
  });
  it('moodWeek on a Monday with one day shows the number', () => {
    assert.deepEqual(moodWeek([{ date: '2026-10-26', score: 3 }], '2026-10-26'), { avg: 3, prevAvg: null, days: 1 });
  });
  it('moodWeek rounds to 1 decimal', () => {
    const rows: MoodRow[] = [{ date: '2026-10-26', score: 4 }, { date: '2026-10-27', score: 4 }, { date: '2026-10-28', score: 5 }];
    assert.equal(moodWeek(rows, TODAY).avg, 4.3);
  });
  it('dailySeries gives n slots, oldest first, null for gaps, ignores future', () => {
    const s = dailySeries([{ date: '2026-10-28', score: 5 }, { date: '2026-10-27', score: 2 }, { date: '2026-10-27', score: 4 }, { date: '2026-10-29', score: 1 }], TODAY, 14);
    assert.equal(s.length, 14);
    assert.equal(s[0].date, '2026-10-15');
    assert.equal(s[13].date, TODAY);
    assert.equal(s[13].value, 5);
    assert.equal(s[12].value, 3);
    assert.equal(s[0].value, null);
  });
});

describe('sleep', () => {
  it('findSleepIds matches names starting with sleep, trimmed, any case', () => {
    const ids = findSleepIds([{ id: '0', name: ' Sleep ', color: '' }, { id: '4', name: 'sleeping in', color: '' }, { id: '1', name: 'work', color: '' }, { id: '9', name: 'nap sleep', color: '' }]);
    assert.deepEqual([...ids].sort(), ['0', '4']);
  });
  it('findSleepIds: a saved group wins over the name', () => {
    const ids = findSleepIds([{ id: '0', name: 'sleep', color: '', group: 'rest' }, { id: '9', name: 'nap', color: '', group: 'sleep' }]);
    assert.deepEqual([...ids], ['9']);
  });
  it('findSleepIds with no sleep category is empty', () => {
    assert.equal(findSleepIds([{ id: '1', name: 'work', color: '' }]).size, 0);
  });
  it('a night across midnight adds D-1 18-23 and D 0-11', () => {
    const rows = [...hours('2026-10-26', 22, 23, 0), ...hours('2026-10-27', 0, 6, '0'), ...hours('2026-10-27', 13, 14, 0), ...hours('2026-10-26', 10, 11, 0)];
    const n = sleepNights(rows, new Set(['0']), ['2026-10-27']);
    assert.deepEqual(n, [{ date: '2026-10-27', hours: 9 }]);
  });
  it('a duplicate hour row counts once', () => {
    const rows = [...hours('2026-10-27', 0, 2, 0), ...hours('2026-10-27', 0, 2, 0)];
    assert.equal(sleepNights(rows, new Set(['0']), ['2026-10-27'])[0].hours, 3);
  });
  it('sleepNights only reports the dates asked for (future rows ignored)', () => {
    const n = sleepNights(hours('2026-10-29', 0, 6, 0), new Set(['0']), ['2026-10-28']);
    assert.deepEqual(n, [{ date: '2026-10-28', hours: null }]);
  });
  it('unknown night is null, not 0', () => {
    const n = sleepNights(hours('2026-10-27', 9, 10, 1), new Set(['0']), ['2026-10-27']);
    assert.deepEqual(n, [{ date: '2026-10-27', hours: null }]);
  });
  it('no sleep ids gives all null', () => {
    assert.deepEqual(sleepNights(hours('2026-10-27', 0, 6, 0), new Set(), ['2026-10-27']), [{ date: '2026-10-27', hours: null }]);
  });
  it('crosses the year (Jan 1 night uses Dec 31 rows)', () => {
    const rows = [...hours('2025-12-31', 23, 23, 0), ...hours('2026-01-01', 0, 6, 0)];
    assert.equal(sleepNights(rows, new Set(['0']), ['2026-01-01'])[0].hours, 8);
  });
  it('avgKnown skips nulls, 1 decimal, null when none', () => {
    assert.equal(avgKnown([{ date: 'a', hours: 7 }, { date: 'b', hours: null }, { date: 'c', hours: 8.2 }]), 7.6);
    assert.equal(avgKnown([{ date: 'a', hours: null }]), null);
    assert.equal(avgKnown([]), null);
  });
});

describe('moodSplit', () => {
  const moods = (pairs: Array<[number, number]>): MoodRow[] => pairs.map(([d, s]) => ({ date: `2026-09-${String(d).padStart(2, '0')}`, score: s }));
  const flags = (n: number, hiCount: number) => new Map(Array.from({ length: n }, (_, i) => [`2026-09-${String(i + 1).padStart(2, '0')}`, i < hiCount] as const));
  it('null under 10 pairs', () => {
    const m = moods(Array.from({ length: 9 }, (_, i) => [i + 1, 3] as [number, number]));
    assert.equal(moodSplit(m, flags(9, 5), TODAY), null);
  });
  it('null when a side has under 3', () => {
    const m = moods(Array.from({ length: 12 }, (_, i) => [i + 1, 3] as [number, number]));
    assert.equal(moodSplit(m, flags(12, 2), TODAY), null);
    assert.equal(moodSplit(m, flags(12, 10), TODAY), null);
  });
  it('computes sides and diff', () => {
    const m = moods(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 4 : 3] as [number, number]));
    assert.deepEqual(moodSplit(m, flags(10, 5), TODAY), { hi: 4, lo: 3, nHi: 5, nLo: 5, diff: 1 });
  });
  it('ignores days without a mood or without a flag', () => {
    const m = moods(Array.from({ length: 10 }, (_, i) => [i + 1, 3] as [number, number]));
    const r = moodSplit(m, flags(12, 6), TODAY); // 2 flagged days have no mood
    assert.ok(r);
    assert.equal(r.nHi + r.nLo, 10);
  });
  it('rounds to 1 decimal', () => {
    const m = moods([[1, 5], [2, 4], [3, 4], [4, 2], [5, 2], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3]]);
    const r = moodSplit(m, flags(10, 3), TODAY);
    assert.ok(r);
    assert.equal(r.hi, 4.3);
    assert.equal(r.lo, 2.7);
    assert.equal(r.diff, 1.6);
  });
});

describe('habits', () => {
  const log = (date: string, activityId: string, completed = true): HabitLog => ({ date, activityId, completed });
  const dates = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
  it('habitDays counts only active habits and completed checks, once each', () => {
    const logs = [log('2026-10-27', 'a'), log('2026-10-27', 'b'), log('2026-10-27', 'old'), log('2026-10-28', 'a', false), log('2026-10-27', 'a')];
    const d = habitDays(logs, new Set(['a', 'b']), dates);
    assert.deepEqual(d.find((x) => x.date === '2026-10-27'), { date: '2026-10-27', done: 2, active: 2, share: 1 });
    assert.deepEqual(d.find((x) => x.date === '2026-10-28'), { date: '2026-10-28', done: 0, active: 2, share: 0 });
  });
  it('no active habits: share 0, rate null', () => {
    const d = habitDays([log('2026-10-27', 'a')], new Set(), dates);
    assert.equal(d[0].share, 0);
    assert.equal(habitRate(d), null);
    assert.equal(habitRate([]), null);
  });
  it('habitRate is a whole percent', () => {
    const d = habitDays([log('2026-10-26', 'a'), log('2026-10-27', 'a'), log('2026-10-27', 'b')], new Set(['a', 'b', 'c']), ['2026-10-26', '2026-10-27']);
    assert.equal(habitRate(d), 50); // 3 of 6
  });
  it('streak starts yesterday when today is below 50%', () => {
    const d = habitDays([log('2026-10-26', 'a'), log('2026-10-26', 'b'), log('2026-10-27', 'a'), log('2026-10-27', 'b')], new Set(['a', 'b']), dates);
    assert.equal(habitStreak(d, TODAY), 2); // today empty, counted from yesterday
  });
  it('a low-share yesterday gives no streak', () => {
    const d = habitDays([log('2026-10-27', 'a')], new Set(['a', 'b', 'c']), dates);
    assert.equal(habitStreak(d, TODAY), 0);
  });
  it('streak includes today when it meets 50%', () => {
    const d = habitDays([log('2026-10-26', 'a'), log('2026-10-27', 'a'), log('2026-10-28', 'a')], new Set(['a', 'b']), dates);
    assert.equal(habitStreak(d, TODAY), 3);
  });
  it('streak breaks on a missing day and ignores future days', () => {
    const d = habitDays([log('2026-10-27', 'a'), log('2026-10-29', 'a')], new Set(['a']), ['2026-10-27', '2026-10-28', '2026-10-29']);
    assert.equal(habitStreak(d, TODAY), 1);
    assert.equal(habitStreak([], TODAY), 0);
  });
  it('stopped habits do not count (caller passes only active ids)', () => {
    const d = habitDays([log('2026-10-27', 'a'), log('2026-10-27', 'stopped')], new Set(['a']), ['2026-10-27']);
    assert.deepEqual(d[0], { date: '2026-10-27', done: 1, active: 1, share: 1 });
  });
  it('bestStreak finds the longest consecutive run', () => {
    const mk = (date: string, share: number) => ({ date, done: share, active: 1, share });
    const d = [mk('2026-10-20', 1), mk('2026-10-21', 1), mk('2026-10-22', 0), mk('2026-10-23', 1), mk('2026-10-24', 1), mk('2026-10-25', 0.5), mk('2026-10-27', 1)];
    assert.equal(bestStreak(d, TODAY), 3);
    assert.equal(bestStreak([], TODAY), 0);
    assert.equal(bestStreak([mk('2026-10-28', 1), mk('2026-10-29', 1), mk('2026-10-30', 1)], TODAY), 1); // future dropped
  });
});

describe('timeCompare', () => {
  it('rest week gives no rows and no top', () => {
    assert.deepEqual(timeCompare([], cats, TODAY), { rows: [], other: null, all: [], total: 0, top: null });
  });
  it('splits this week against the same days last week', () => {
    const e = [
      ...hours('2026-10-26', 9, 16, 1), ...hours('2026-10-27', 9, 12, 2), // this week: work 8, friends 4
      ...hours('2026-10-19', 9, 12, 1), // last Mon: work 4
      ...hours('2026-10-22', 9, 12, 1), // last Thu: outside window
      ...hours('2026-10-29', 9, 12, 1), // future
    ];
    const r = timeCompare(e, cats, TODAY);
    assert.equal(r.total, 12);
    assert.deepEqual(r.rows.map((x) => [x.id, x.name, x.hours, x.prev]), [['1', 'work', 8, 4], ['2', 'friends', 4, 0]]);
    assert.deepEqual(r.top, { name: 'work', hours: 8, delta: 4 });
  });
  it('caps rows at max but total keeps everything', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `c${i}`, color: '#000' }));
    const e = many.flatMap((c, i) => hours('2026-10-26', 0, i, c.id));
    const r = timeCompare(e, many, TODAY, 3);
    assert.equal(r.rows.length, 3);
    assert.equal(r.total, 28);
    assert.equal(r.rows[0].id, '6');
    assert.equal(r.other?.hours, 1 + 2 + 3 + 4); // c3..c0 hold 4,3,2,1 hours
    assert.equal(r.all.length, 7);
  });
  it('keeps a category that only had hours last week in all, not in rows', () => {
    const r = timeCompare([...hours('2026-10-26', 9, 10, 1), ...hours('2026-10-19', 9, 12, 2)], cats, TODAY);
    assert.deepEqual(r.rows.map((x) => x.id), ['1']);
    assert.deepEqual(r.all.map((x) => [x.id, x.hours, x.prev]), [['1', 2, 0], ['2', 0, 4]]);
    assert.equal(r.total, 2);
    assert.equal(r.other, null);
  });
  it('unknown category falls back to Other', () => {
    const r = timeCompare(hours('2026-10-26', 0, 1, 99), cats, TODAY);
    assert.equal(r.rows[0].name, 'Other');
  });
});

describe('lastHighlight and climbWeek', () => {
  it('lastHighlight picks newest non-empty before today within 30 days', () => {
    const rows = [
      { date: '2026-10-28', text: 'today' }, { date: '2026-10-27', text: '   ' },
      { date: '2026-10-25', text: ' Good day ' }, { date: '2026-10-20', text: 'older' }, { date: '2026-10-30', text: 'future' },
    ];
    assert.deepEqual(lastHighlight(rows, TODAY), { date: '2026-10-25', text: 'Good day' });
  });
  it('lastHighlight is null when too old or empty', () => {
    assert.equal(lastHighlight([{ date: '2026-09-01', text: 'x' }], TODAY), null);
    assert.equal(lastHighlight([], TODAY), null);
    assert.equal(lastHighlight([{ date: '2026-09-28', text: 'edge' }], TODAY)?.text, 'edge'); // exactly 30 days back
  });
  it('climbWeek counts date+session pairs from Monday', () => {
    const logs = [
      { date: '2026-10-26', session: 1 }, { date: '2026-10-26', session: 1 }, { date: '2026-10-26', session: 2 },
      { date: '2026-10-28', session: 1 }, { date: '2026-10-25', session: 1 }, { date: '2026-10-29', session: 1 },
    ];
    assert.deepEqual(climbWeek(logs, TODAY), { sessions: 3, last: '2026-10-28', daysSince: 0 });
  });
  it('climbWeek rest week reports last session and days since', () => {
    assert.deepEqual(climbWeek([{ date: '2026-10-22', session: 1 }], TODAY), { sessions: 0, last: '2026-10-22', daysSince: 6 });
  });
  it('climbWeek with no logs', () => {
    assert.deepEqual(climbWeek([], TODAY), { sessions: 0, last: null, daysSince: null });
  });
  it('climbWeek without session falls back to unique dates', () => {
    assert.equal(climbWeek([{ date: '2026-10-26' }, { date: '2026-10-26' }, { date: '2026-10-27' }], TODAY).sessions, 2);
  });
});

describe('final review fixes', () => {
  it('sleepNights: tonight with only evening hours is not known yet (no morning hour logged)', () => {
    const rows = hours('2026-10-27', 22, 23, 0); // last night's 22-23h only
    assert.deepEqual(sleepNights(rows, new Set(['0']), [TODAY], TODAY), [{ date: TODAY, hours: null }]);
  });
  it('sleepNights: tonight counts once a morning hour is logged', () => {
    const rows = [...hours('2026-10-27', 22, 23, 0), ...hours(TODAY, 0, 6, 0)];
    assert.equal(sleepNights(rows, new Set(['0']), [TODAY], TODAY)[0].hours, 9);
  });
  it('sleepNights: past nights with only evening hours still count', () => {
    const rows = hours('2026-10-26', 22, 23, 0);
    assert.equal(sleepNights(rows, new Set(['0']), ['2026-10-27'], TODAY)[0].hours, 2);
  });
  it('daySpan: starts at the floor when a stray old row is far back, and always ends today', () => {
    const s = daySpan('1926-10-28', TODAY, '2025-01-01');
    assert.equal(s[0], '2025-01-01');
    assert.equal(s[s.length - 1], TODAY);
  });
  it('daySpan: starts at the first row when it is after the floor', () => {
    assert.deepEqual(daySpan('2026-10-26', TODAY, '2025-01-01'), ['2026-10-26', '2026-10-27', TODAY]);
  });
});
