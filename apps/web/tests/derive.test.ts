import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveOverview, type DashboardData } from '../src/components/overview/derive.ts';
import type { QuickPayload } from '@journaling/core/quickPayload';

const TODAY = '2026-10-28'; // Wednesday; this week Mon 26 to Wed 28, last week's same days 19 to 21

/** Every number in the view, so a NaN anywhere fails the test. */
function numbers(v: unknown, out: number[] = []): number[] {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbers(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => numbers(x, out));
  return out;
}

const empty: DashboardData = {
  activities: [], logs30: [], highlights30: [], moods7: [], moodsPrev7: [],
  timeCategories: [], timeY: [], climbY: [], climb30: [], goals: [], sidequests: [],
};

const hours = (date: string, from: number, to: number, category: number) =>
  Array.from({ length: to - from }, (_, i) => ({ date, hour: from + i, category }));

test('nothing loaded yet: sections are null so the UI shows skeletons', () => {
  const v = deriveOverview({ today: TODAY, dash: null, quick: null });
  assert.equal(v.mood, null);
  assert.equal(v.habits, null);
  assert.equal(v.time, null);
  assert.equal(v.climb, null);
  assert.equal(v.quests, null);
  assert.equal(v.remember.ready, false);
});

test('brand-new user: every section has its empty answer and no NaN', () => {
  const v = deriveOverview({ today: TODAY, dash: empty, quick: null });
  assert.equal(v.mood?.avg, null);
  assert.equal(v.mood?.delta, null);
  assert.equal(v.mood?.link, null); // no sleep category, no habits: nothing to link
  assert.equal(v.habits?.rate, null);
  assert.equal(v.habits?.streak, 0);
  assert.equal(v.habits?.count, 0);
  assert.equal(v.time?.top, null);
  assert.equal(v.time?.total, 0);
  assert.equal(v.time?.sleepOnly, false);
  assert.equal(v.remember.ready, true);
  assert.equal(v.remember.highlight, null);
  assert.equal(v.climb, null);
  assert.deepEqual(v.quests, { active: 0 });
  assert.ok(numbers(v).every((n) => Number.isFinite(n)), 'no NaN or Infinity');
});

test('mood compares this week with the same days last week', () => {
  const v = deriveOverview({
    today: TODAY,
    quick: null,
    dash: {
      ...empty,
      moods7: [{ date: '2026-10-26', score: 6 }, { date: '2026-10-27', score: 8 }],
      moodsPrev7: [{ date: '2026-10-19', score: 5 }, { date: '2026-10-20', score: 5 }],
    },
  });
  assert.equal(v.mood?.avg, 7);
  assert.equal(v.mood?.prevAvg, 5);
  assert.equal(v.mood?.delta, 2);
  assert.equal(v.mood?.bars.length, 14);
  assert.equal(v.mood?.bars.filter((b) => b.thisWeek).length, 3);
});

test('time answer leaves sleep out, the sheet keeps it', () => {
  const v = deriveOverview({
    today: TODAY,
    quick: null,
    dash: {
      ...empty,
      timeCategories: [{ id: '0', name: 'sleep', color: '#00f' }, { id: '1', name: 'work', color: '#f90' }],
      timeY: [...hours('2026-10-26', 0, 8, 0), ...hours('2026-10-26', 9, 18, 1), ...hours('2026-10-19', 9, 14, 1)],
    },
  });
  assert.deepEqual(v.time?.top, { name: 'work', hours: 9, delta: 4 });
  assert.ok(v.time?.all.some((r) => r.name === 'sleep'));
  assert.ok(!v.time?.rows.some((r) => r.name === 'sleep'));
  assert.equal(v.mood?.sheet.hasSleep, true);
});

test('only sleep logged this week: the time answer says so', () => {
  const v = deriveOverview({
    today: TODAY,
    quick: null,
    dash: { ...empty, timeCategories: [{ id: '0', name: 'sleep', color: '#00f' }], timeY: hours('2026-10-26', 0, 8, 0) },
  });
  assert.equal(v.time?.top, null);
  assert.equal(v.time?.sleepOnly, true);
});

test('habit table: % of the last 14 days per habit', () => {
  const v = deriveOverview({
    today: TODAY,
    quick: null,
    dash: {
      ...empty,
      activities: [{ id: 'a', name: 'Read' }, { id: 'b', name: 'Walk' }],
      logs30: [
        { date: '2026-10-27', activityId: 'a', completed: true },
        { date: '2026-10-27', activityId: 'b', completed: false },
        { date: '2026-10-28', activityId: 'a', completed: true },
      ],
    },
  });
  assert.equal(v.habits?.count, 2);
  assert.deepEqual(v.habits?.table.map((r) => [r.name, r.pct]), [['Read', 14], ['Walk', 0]]);
  assert.equal(v.habits?.bars.length, 14);
  const rate = v.habits?.rate;
  assert.ok(typeof rate === 'number' && rate > 0 && rate <= 100);
});

test("Today's data wins over the dashboard for the same day", () => {
  const day = (date: string, mood: number | null) => ({
    date, mood, weight: null, highlight: date === TODAY ? 'Sent it' : '', logs: [],
    hours: Array.from({ length: 24 }, () => null), climbs: 0, sidequestLogIds: [],
  });
  const quick: QuickPayload = {
    ctx: { activities: [], categoryIds: [], sidequests: [], year: 2026 },
    days: { [TODAY]: day(TODAY, 9) },
    templates: { weekday: null, weekend: null },
    habitTemplates: { weekday: null, weekend: null },
    reminderEnabled: false,
  };
  const v = deriveOverview({
    today: TODAY,
    quick,
    dash: { ...empty, moods7: [{ date: TODAY, score: 3 }], highlights30: [{ date: '2026-10-20', text: 'older' }] },
  });
  assert.equal(v.mood?.bars.find((b) => b.date === TODAY)?.value, 9);
  // Today itself is not "remembered": the last highlight is the one before today.
  assert.equal(v.remember.highlight?.text, 'older');
});

test('early January: the climbing line uses late-December climbs', () => {
  const v = deriveOverview({
    today: '2027-01-05',
    quick: null,
    dash: { ...empty, climbY: [], climb30: [{ date: '2026-12-20', type: 'boulder', grade: 'V4', session: 1 }] },
  });
  assert.deepEqual(v.climb, { sessions: 0, last: '2026-12-20', daysSince: 16 });
});

test('month-ago read: loaded, failed, or still waiting', () => {
  const waiting = deriveOverview({ today: TODAY, dash: empty, quick: null });
  assert.deepEqual([waiting.remember.monthAgo.loaded, waiting.remember.monthAgo.failed], [false, false]);
  const failed = deriveOverview({ today: TODAY, dash: empty, quick: null, rememberFailed: true });
  assert.equal(failed.remember.monthAgo.failed, true);
  assert.equal(failed.remember.monthAgo.date, '2026-09-28');
});

test('recap: needs every source, then shows last week', () => {
  const moods90 = [{ date: '2026-10-20', score: 7 }] as NonNullable<Parameters<typeof deriveOverview>[0]['moods90']>;
  const quick = { days: {}, ctx: { activities: [] }, stamps: [] } as unknown as QuickPayload;
  assert.equal(deriveOverview({ today: TODAY, dash: empty, quick: null, moods90 }).recap, null);
  assert.equal(deriveOverview({ today: TODAY, dash: empty, quick }).recap, null);
  const recap = deriveOverview({ today: TODAY, dash: empty, quick, moods90 }).recap;
  assert.equal(recap?.from, '2026-10-19');
  assert.equal(recap?.mood.avg, 7);
});
