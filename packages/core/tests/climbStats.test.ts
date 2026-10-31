import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  byGym, daysSince, firstSends, flashGrade, goalPace, gradePyramid, gradeTable, groupBySession, hardestByMonth, hardestFlash, hardestSend,
  newBest, sendsPerWeek, sessionRecords, sessionsCount, weekStreak, weekdayCounts, weeklySeries, yearOverYear,
  type Log,
} from '../src/climbStats.ts';

let n = 0;
const log = (date: string, grade = 'V4', attempts = 1, session = 1, type: 'boulder' | 'rope' = 'boulder', location?: string): Log =>
  ({ id: `l${n++}`, date, session, type, grade, attempts, location });

const TODAY = '2026-10-27'; // a Tuesday; its week starts Mon 2026-10-26

describe('climb stats: sessions and weeks', () => {
  it('sessionsCount counts unique date|session pairs', () => {
    assert.equal(sessionsCount([log('2026-10-01', 'V4', 1, 1), log('2026-10-01', 'V5', 1, 1), log('2026-10-01', 'V4', 1, 2), log('2026-10-02', 'V4', 1, 1)]), 3);
  });

  it('weeklySeries fills zero weeks', () => {
    const s = weeklySeries([log('2026-10-01'), log('2026-10-20')], '2026-10-01', '2026-10-27');
    assert.deepEqual(s, [
      { start: '2026-09-28', count: 1 }, { start: '2026-10-05', count: 0 }, { start: '2026-10-12', count: 0 },
      { start: '2026-10-19', count: 1 }, { start: '2026-10-26', count: 0 },
    ]);
  });

  it('weeklySeries accepts a time suffix and an inverted range', () => {
    assert.equal(weeklySeries([log('2026-10-20T10:00:00')], '2026-10-19', '2026-10-19')[0].count, 1);
    assert.deepEqual(weeklySeries([], '2026-10-27', '2026-10-01'), []);
  });

  it('sendsPerWeek averages 12 weeks with zeros', () => {
    const logs = Array.from({ length: 12 }, () => log('2026-10-27'));
    assert.equal(sendsPerWeek(logs, TODAY), 1.0);
    assert.equal(sendsPerWeek([log('2026-10-27')], TODAY), 0.1);
    assert.equal(sendsPerWeek([log('2025-01-01')], TODAY), 0);
  });

  it('groupBySession puts back-dated logs in the right day, newest first', () => {
    const a = log('2026-10-27', 'V4', 1, 2);
    const b = log('2026-10-01', 'V4', 1, 1);
    const c = log('2026-10-27', 'V5', 1, 1);
    const g = groupBySession([a, b, c]);
    assert.deepEqual(g.map((d) => d.date), ['2026-10-27', '2026-10-01']);
    assert.deepEqual(g[0].sessions.map((s) => s.session), [1, 2]);
    assert.deepEqual(g[0].sessions[0].logs, [c]);
  });
});

describe('climb stats: goal pace', () => {
  const goal = { year: 2026, type: 'boulder' as const, grade: 'V4', target: 100 };
  const january = Array.from({ length: 50 }, (_, i) => log(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, 'V4'));

  it('rest weeks count as zero, so an early burst is not on track', () => {
    const p = goalPace(goal, january, TODAY);
    assert.equal(p.done, 50);
    assert.equal(p.recentPerWeek, 0);
    assert.equal(p.onTrack, false);
    assert.ok(p.neededPerWeek > 0);
    assert.equal(p.ended, false);
    assert.equal(p.projected, 50);
    assert.equal(p.weeksLeft, 9);
  });

  it('a past year is ended with nothing needed', () => {
    const p = goalPace(goal, january, '2027-01-05');
    assert.equal(p.ended, true);
    assert.equal(p.neededPerWeek, 0);
    assert.equal(p.weeksLeft, 0);
    assert.equal(p.done, 50);
  });

  it('counts only the exact grade and type, and recent sends lift the projection', () => {
    const recent = Array.from({ length: 16 }, (_, i) => log(`2026-10-${String(i + 5).padStart(2, '0')}`, 'v4'));
    const noise = [log('2026-10-10', 'V5'), log('2026-10-10', '6a', 1, 1, 'rope')];
    const p = goalPace({ ...goal, target: 20 }, [...recent, ...noise], TODAY);
    assert.equal(p.done, 16);
    assert.equal(p.recentPerWeek, 2); // 16 over the last 8 weeks
    assert.equal(p.projected, 34);
    assert.equal(p.onTrack, true);
  });

  it('is calm for a year with no logs and for a future year', () => {
    const p = goalPace(goal, [], TODAY);
    assert.equal(p.done, 0);
    assert.equal(p.recentPerWeek, 0);
    assert.equal(p.neededPerWeek, 11.1);
    const f = goalPace({ ...goal, year: 2027 }, [], TODAY);
    assert.equal(f.ended, false);
    assert.ok(f.weeksLeft >= 1 && Number.isFinite(f.neededPerWeek));
  });

  it('treats a future-year goal as not started and on track', () => {
    const f = goalPace({ ...goal, year: 2027 }, [], '2026-10-27');
    assert.equal(f.notStarted, true);
    assert.equal(f.onTrack, true);
    assert.equal(f.projected, 0);
    assert.equal(f.recentPerWeek, 0);
    assert.ok(Number.isFinite(f.neededPerWeek) && f.neededPerWeek > 0);
    assert.equal(goalPace(goal, [], TODAY).notStarted, false);
  });

  it('never needs below zero once the target is met', () => {
    const p = goalPace({ ...goal, target: 2 }, [log('2026-10-01'), log('2026-10-02'), log('2026-10-03')], TODAY);
    assert.equal(p.neededPerWeek, 0);
    assert.equal(p.onTrack, true);
  });
});

describe('climb stats: grades', () => {
  it('gradePyramid is hardest first with unparseable last', () => {
    const logs = [log('2026-10-01', 'V4'), log('2026-10-01', 'v4'), log('2026-10-01', 'V6'), log('2026-10-01', 'x')];
    assert.deepEqual(gradePyramid(logs, 'boulder'), [{ grade: 'V6', count: 1 }, { grade: 'V4', count: 2 }, { grade: 'x', count: 1 }]);
    assert.deepEqual(gradePyramid([log('2026-10-01', '6a', 1, 1, 'rope'), log('2026-10-01', '7a', 1, 1, 'rope')], 'rope').map((g) => g.grade), ['7a', '6a']);
  });

  it('hardestSend and hardestFlash', () => {
    const logs = [log('2026-10-01', 'V4', 0), log('2026-10-02', 'V6', 2), log('2026-10-03', 'V5', 1)];
    assert.deepEqual(hardestSend(logs, 'boulder'), { grade: 'V6', date: '2026-10-02' });
    assert.deepEqual(hardestFlash(logs, 'boulder'), { grade: 'V4', date: '2026-10-01' });
    assert.equal(hardestSend(logs, 'rope'), null);
  });

  it('newBest compares with earlier sends by date, not sheet order', () => {
    assert.equal(newBest([log('2026-10-01', 'V5'), log('2026-10-27', 'V6')], '2026-10-27'), 'V6');
    assert.equal(newBest([log('2026-10-27', 'V6'), log('2026-10-01', 'V5')], '2026-10-27'), 'V6');
    assert.equal(newBest([log('2026-10-01', 'V6'), log('2026-10-27', 'V5')], '2026-10-27'), null);
    assert.equal(newBest([log('2026-10-27', 'V5')], '2026-10-27'), null);
    assert.equal(newBest([log('2026-10-05', 'V7'), log('2026-10-01', 'V5')], '2026-10-27'), null);
    // a later log does not count as "earlier"
    assert.equal(newBest([log('2026-10-27', 'V5'), log('2026-10-01', 'V4'), log('2026-11-01', 'V9')], '2026-10-27'), 'V5');
  });

  it('newBest checks boulder first, then rope', () => {
    const logs = [log('2026-10-01', 'V4'), log('2026-10-01', '6a', 1, 1, 'rope'), log('2026-10-27', '6b', 1, 1, 'rope')];
    assert.equal(newBest(logs, '2026-10-27'), '6b');
    assert.equal(newBest([...logs, log('2026-10-27', 'V5')], '2026-10-27'), 'V5');
  });

  it('hardestByMonth has 12 entries, null for empty months', () => {
    const r = hardestByMonth([log('2026-03-05', 'V4'), log('2026-03-20', 'V6'), log('2025-03-20', 'V9')], 2026, 'boulder');
    assert.equal(r.length, 12);
    assert.equal(r[2].grade, 'V6');
    assert.equal(r[2].month, 3);
    assert.equal(r[0].grade, null);
    assert.ok(hardestByMonth([], 2026, 'rope').every((m) => m.grade === null));
  });

  it('firstSends uses the earliest date even when back-dated', () => {
    const r = firstSends([log('2026-10-27', 'V5'), log('2026-09-01', 'V5'), log('2026-05-01', 'V4')], 'boulder');
    assert.deepEqual(r, [{ grade: 'V5', date: '2026-09-01' }, { grade: 'V4', date: '2026-05-01' }]);
  });

  it('gradeTable has flash% and average falls', () => {
    const logs = [log('2026-10-01', 'V4', 0), log('2026-10-02', 'V4', 0), log('2026-10-03', 'V4', 0), log('2026-10-04', 'V4', 2), log('2026-10-04', 'V5', 3)];
    assert.deepEqual(gradeTable(logs, 'boulder'), [
      { grade: 'V5', sends: 1, flashPct: 0, avgFalls: 3 },
      { grade: 'V4', sends: 4, flashPct: 75, avgFalls: 0.5 },
    ]);
  });

  it('flashGrade needs 3 sends and 50 percent flashes', () => {
    const two = [log('2026-10-01', 'V5', 0), log('2026-10-02', 'V5', 0)];
    assert.equal(flashGrade(two, 'boulder'), null);
    const v4 = [log('2026-10-01', 'V4', 0), log('2026-10-02', 'V4', 0), log('2026-10-03', 'V4', 3)];
    assert.equal(flashGrade([...two, ...v4], 'boulder'), 'V4');
    assert.equal(flashGrade([...two, log('2026-10-03', 'V5', 1)], 'boulder'), 'V5');
    assert.equal(flashGrade([...two, log('2026-10-03', 'V5', 1), log('2026-10-03', 'V5', 1), log('2026-10-03', 'V5', 1)], 'boulder'), null);
  });
});

describe('climb stats: habits', () => {
  it('weekStreak counts back from this week', () => {
    assert.equal(weekStreak([log('2026-10-27'), log('2026-10-20'), log('2026-10-13')], TODAY), 3);
  });

  it('weekStreak starts from last week when this week is empty', () => {
    assert.equal(weekStreak([log('2026-10-20'), log('2026-10-13')], TODAY), 2);
  });

  it('weekStreak stops at a gap (a rest week) and uses log dates, not sheet order', () => {
    const logs = [log('2026-10-13'), log('2026-10-27'), log('2026-10-20'), log('2026-09-29'), log('2026-10-01')];
    assert.equal(weekStreak(logs, TODAY), 3);
    assert.equal(weekStreak([log('2026-10-27'), log('2026-10-06')], TODAY), 1);
    assert.equal(weekStreak([log('2026-10-06')], TODAY), 0); // last week empty too
  });

  it('daysSince', () => {
    assert.equal(daysSince([], TODAY), null);
    assert.equal(daysSince([log('2026-10-20'), log('2026-10-24')], TODAY), 3);
    assert.equal(daysSince([log('2026-10-27T09:00:00')], TODAY), 0);
  });

  it('weekdayCounts is Monday first and counts sessions', () => {
    const r = weekdayCounts([log('2026-10-26'), log('2026-10-26'), log('2026-10-26', 'V4', 1, 2), log('2026-11-01')]);
    assert.deepEqual(r, [2, 0, 0, 0, 0, 0, 1]);
  });

  it('sessionRecords has the most sends with its date', () => {
    const logs = [log('2026-10-01'), log('2026-10-01'), log('2026-10-05'), log('2026-10-05'), log('2026-10-05'), log('2026-10-05', 'V4', 1, 2)];
    assert.deepEqual(sessionRecords(logs), { avgSends: 2, most: 3, mostDate: '2026-10-05' });
  });

  it('yearOverYear compares up to the same month and day', () => {
    const logs = [
      log('2026-03-01', 'V5'), log('2026-10-27', 'V6', 1, 2), log('2026-10-27', 'V4', 1, 1, 'rope'),
      log('2025-10-27', 'V4'), log('2025-11-01', 'V8'), log('2025-02-01', 'V3'),
    ];
    const r = yearOverYear(logs, TODAY);
    assert.equal(r.thisYear.sends, 3);
    assert.equal(r.thisYear.sessions, 3);
    assert.equal(r.lastYear.sends, 2);
    assert.equal(r.lastYear.best, 'V4');
    assert.equal(r.thisYear.best, 'V6');
  });

  it('byGym groups blank locations as No gym', () => {
    const r = byGym([log('2026-10-01', 'V4', 1, 1, 'boulder', 'Rock'), log('2026-10-01', 'V4', 1, 1, 'boulder', ' Rock '), log('2026-10-01'), log('2026-10-01', 'V4', 1, 1, 'boulder', '  ')]);
    assert.deepEqual(r, [{ gym: 'No gym', count: 2 }, { gym: 'Rock', count: 2 }]);
  });
});

describe('climb stats: empty input', () => {
  it('never returns NaN or -Infinity', () => {
    const goal = { year: 2026, type: 'boulder' as const, grade: 'V4', target: 0 };
    assert.equal(sessionsCount([]), 0);
    assert.equal(sendsPerWeek([], TODAY), 0);
    assert.deepEqual(groupBySession([]), []);
    assert.deepEqual(gradePyramid([], 'boulder'), []);
    assert.equal(hardestSend([], 'boulder'), null);
    assert.equal(hardestFlash([], 'rope'), null);
    assert.equal(newBest([], TODAY), null);
    assert.deepEqual(firstSends([], 'boulder'), []);
    assert.deepEqual(gradeTable([], 'boulder'), []);
    assert.equal(flashGrade([], 'boulder'), null);
    assert.equal(weekStreak([], TODAY), 0);
    assert.equal(daysSince([], TODAY), null);
    assert.deepEqual(weekdayCounts([]), [0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(sessionRecords([]), { avgSends: 0, most: 0, mostDate: null });
    assert.deepEqual(byGym([]), []);
    const y = yearOverYear([], TODAY);
    assert.deepEqual(y.thisYear, { sends: 0, sessions: 0, best: null });
    assert.deepEqual(y.lastYear, { sends: 0, sessions: 0, best: null });
    for (const t of [goalPace(goal, [], TODAY), goalPace(goal, [], '2027-03-01')]) {
      for (const v of [t.done, t.target, t.weeksLeft, t.neededPerWeek, t.recentPerWeek, t.projected]) assert.ok(Number.isFinite(v));
    }
  });
});
