import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  attemptsBuckets, buildStory, buildYearStory, chooseGoal, formatStoryDate, goalLine, goalProgress,
  latestSessionDate, paceText, sessionStats, weeklySends,
  type StoryGoal, type StoryLog,
} from '../src/lib/climbStory.ts';

const goal: StoryGoal = { id: 'g1', year: 2026, type: 'boulder', grade: 'V5', target: 100 };
const rope: StoryGoal = { id: 'g2', year: 2026, type: 'rope', grade: '6a', target: 10 };
let n = 0;
const log = (date: string, grade = 'V5', attempts = 1, type: 'boulder' | 'rope' = 'boulder', session = 1): StoryLog => ({ id: `l${n++}`, date, session, type, grade, attempts });

describe('climb story: goal progress and pace', () => {
  it('counts only matching grade, year and dates up to asOf', () => {
    const logs = [log('2026-03-01'), log('2026-03-02', 'v5'), log('2026-03-03', 'V4'), log('2025-12-31'), log('2026-09-01'), log('2026-03-04', '6a', 1, 'rope')];
    const p = goalProgress(goal, logs, '2026-06-01');
    assert.equal(p.done, 2);
    assert.equal(p.pct, 2);
    assert.equal(p.complete, false);
  });

  it('pace wording is kind', () => {
    assert.equal(paceText(100, 100, 40), 'Goal complete');
    assert.equal(paceText(45, 100, 40), '5 ahead');
    assert.equal(paceText(40, 100, 40.2), 'On pace');
    assert.equal(paceText(30, 100, 40), '10 to catch up');
  });

  it('expected pace is linear over the year and clamped', () => {
    assert.equal(goalProgress(goal, [], '2026-01-01').expected, 0);
    assert.equal(goalProgress(goal, [], '2026-12-31').expected, 100);
    assert.equal(goalProgress(goal, [], '2027-05-01').expected, 100);
    assert.equal(goalProgress(goal, [], '2025-05-01').expected, 0);
  });

  it('marks complete at the target and caps pct', () => {
    const logs = Array.from({ length: 12 }, (_, i) => log(`2026-02-${String(i + 1).padStart(2, '0')}`));
    const p = goalProgress({ ...goal, target: 10 }, logs, '2026-03-01');
    assert.equal(p.complete, true);
    assert.equal(p.pct, 100);
    assert.equal(p.pace, 'Goal complete');
  });
});

describe('climb story: goal line', () => {
  it('has one point per day, cumulative, null after the date', () => {
    const line = goalLine(goal, [log('2026-01-01'), log('2026-01-03'), log('2026-01-03')], '2026-01-05');
    assert.equal(line.ideal.length, 365);
    assert.deepEqual(line.actual.slice(0, 7), [1, 1, 3, 3, 3, null, null]);
    assert.equal(line.max, 100);
  });
});

describe('climb story: session stats', () => {
  it('summarises one date', () => {
    const logs = [
      log('2026-10-27', 'V4', 0, 'boulder', 1), log('2026-10-27', 'V6', 3, 'boulder', 2),
      log('2026-10-27', '6b', 2, 'rope', 2), log('2026-10-26', 'V9', 1),
    ];
    const s = sessionStats(logs, '2026-10-27');
    assert.deepEqual(s, { date: '2026-10-27', sends: 3, flashes: 1, attempts: 5, sessions: 2, hardest: 'V6 · 6b', rest: false });
  });

  it('is a rest day with no sends', () => {
    const s = sessionStats([log('2026-10-26')], '2026-10-27');
    assert.equal(s.rest, true);
    assert.equal(s.hardest, '–');
  });
});

describe('climb story: weekly series and attempts', () => {
  it('buckets by Monday week up to the chosen week', () => {
    // 2026-10-27 is a Tuesday; its week starts 2026-10-26.
    const w = weeklySends([log('2026-10-26'), log('2026-10-27'), log('2026-10-19'), log('2026-10-28')], 2026, '2026-10-27');
    assert.equal(w.weeks[w.currentIndex].start, '2026-10-26');
    assert.equal(w.weeks[w.currentIndex].count, 2);
    assert.equal(w.weeks[w.currentIndex - 1].count, 1);
    assert.equal(w.total, 3);
    assert.equal(w.weeks[0].start, '2025-12-29');
  });

  it('buckets attempts, flash first, 4+ last', () => {
    const b = attemptsBuckets([{ attempts: 0 }, { attempts: 0 }, { attempts: 1 }, { attempts: 3 }, { attempts: 4 }, { attempts: 9 }]);
    assert.deepEqual(b.map((x) => x.count), [2, 1, 0, 1, 2]);
    assert.equal(b[0].label, 'Flash');
  });
});

describe('climb story: choices', () => {
  it('picks the goal with most sends that day, else first of the year', () => {
    const goals = [goal, rope, { ...goal, id: 'old', year: 2025 }];
    const logs = [log('2026-10-27', '6a', 1, 'rope'), log('2026-10-27', '6a', 1, 'rope'), log('2026-10-27', 'V5')];
    assert.equal(chooseGoal(goals, logs, '2026-10-27')?.id, 'g2');
    assert.equal(chooseGoal(goals, logs, '2026-10-20')?.id, 'g1');
    assert.equal(chooseGoal(goals, logs, '2025-06-01')?.id, 'old');
    assert.equal(chooseGoal([], logs, '2026-10-27'), null);
  });

  it('finds the latest session date and formats dates', () => {
    assert.equal(latestSessionDate([log('2026-03-01'), log('2026-10-27T00:00:00'), log('2026-05-01')]), '2026-10-27');
    assert.equal(latestSessionDate([]), null);
    assert.equal(formatStoryDate('2026-10-27'), 'Tue 27 Oct');
  });

  it('buildStory ties it together', () => {
    const s = buildStory(goal, [log('2026-10-27', 'V5', 0)], '2026-10-27');
    assert.equal(s.goal.grade, 'V5');
    assert.equal(s.goal.typeLabel, 'Boulder');
    assert.equal(s.session.flashes, 1);
    assert.equal(s.attempts[0].count, 1);
    assert.equal(s.dateLabel, 'Tue 27 Oct');
  });
});

describe('climb story: all goals of the year', () => {
  it('lists the goals of the date year and adds them up', () => {
    const goals = [goal, rope, { ...goal, id: 'old', year: 2025 }];
    const logs = [log('2026-03-01'), log('2026-03-02'), log('2026-04-01', '6a', 1, 'rope'), log('2025-06-01')];
    const y = buildYearStory(goals, logs, '2026-07-02');
    assert.equal(y.year, 2026);
    assert.deepEqual(y.goals.map((g) => [g.id, g.done, g.target]), [['g1', 2, 100], ['g2', 1, 10]]);
    assert.equal(y.goals[1].grade, '6a');
    assert.equal(y.goals[1].typeLabel, 'Rope');
    assert.equal(y.total.done, 3);
    assert.equal(y.total.target, 110);
    assert.equal(y.total.pct, 3);
    assert.equal(y.total.complete, false);
    assert.equal(y.total.pace, paceText(3, 110, y.goals[0].expected + y.goals[1].expected));
  });

  it('is complete only when every goal is complete', () => {
    const small = { ...rope, target: 1 };
    const logs = [log('2026-04-01', '6a', 1, 'rope'), log('2026-04-01'), log('2026-04-02')];
    assert.equal(buildYearStory([small, { ...goal, target: 2 }], logs, '2026-05-01').total.complete, true);
    assert.equal(buildYearStory([small, { ...goal, target: 3 }], logs, '2026-05-01').total.complete, false);
  });

  it('has no goals for a year without goals', () => {
    const y = buildYearStory([goal], [], '2024-05-01');
    assert.equal(y.goals.length, 0);
    assert.equal(y.total.target, 0);
    assert.equal(y.total.complete, false);
  });
});

describe('climb story: all goals total', () => {
  it('caps each goal so extra sends on one goal do not finish the total', () => {
    const logs = [log('2026-04-01'), log('2026-04-02'), log('2026-04-03')];
    const y = buildYearStory([{ ...goal, target: 1 }, { ...rope, target: 2 }], logs, '2026-05-01');
    assert.equal(y.total.done, 1);
    assert.equal(y.total.target, 3);
    assert.equal(y.total.complete, false);
    assert.notEqual(y.total.pace, 'Goal complete');
  });
});
