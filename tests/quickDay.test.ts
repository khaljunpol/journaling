import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayStatus,
  missingInOrder,
  templateKind,
  applyTemplate,
  parseTemplate,
  type DayData,
  type Ctx,
} from '../src/lib/quickDay.ts';

const full24 = (id: number): Array<number | null> => Array.from({ length: 24 }, () => id);

const emptyDay = (over: Partial<DayData> = {}): DayData => ({
  date: '2026-10-26',
  mood: null,
  weight: null,
  highlight: '',
  logs: [],
  hours: Array.from({ length: 24 }, () => null),
  climbs: 0,
  sidequestLogIds: [],
  ...over,
});

const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  activities: [
    { id: 'a1', name: 'Read' },
    { id: 'a2', name: 'Walk', status: 'active' },
    { id: 'a3', name: 'Old', status: 'stopped' },
  ],
  categoryIds: [1, 2, 3],
  sidequests: [{ id: 's1', type: 'count', year: 2026 }],
  year: 2026,
  ...over,
});

const item = (s: ReturnType<typeof dayStatus>, key: string) => s.items.find((i) => i.key === key)!;

test('empty day with activities and a count quest has 6 counted items', () => {
  const s = dayStatus(emptyDay(), ctx());
  assert.equal(s.total, 6);
  assert.equal(s.filled, 0);
});

test('no activities and no quests gives total 4', () => {
  const s = dayStatus(emptyDay(), ctx({ activities: [], sidequests: [] }));
  assert.equal(s.total, 4);
  assert.deepEqual(
    [item(s, 'habits').shown, item(s, 'habits').counts, item(s, 'sidequests').shown, item(s, 'sidequests').counts],
    [false, false, false, false],
  );
});

test('habits need a row (true or false) for every active activity', () => {
  const some = dayStatus(emptyDay({ logs: [{ activityId: 'a1', completed: true }] }), ctx());
  assert.equal(item(some, 'habits').filled, false);
  const all = dayStatus(
    emptyDay({ logs: [{ activityId: 'a1', completed: true }, { activityId: 'a2', completed: false }] }),
    ctx(),
  );
  assert.equal(item(all, 'habits').filled, true);
});

test('stopped activity with a row is not required', () => {
  const s = dayStatus(
    emptyDay({
      logs: [
        { activityId: 'a1', completed: true },
        { activityId: 'a2', completed: true },
        { activityId: 'a3', completed: true },
      ],
    }),
    ctx(),
  );
  assert.equal(item(s, 'habits').filled, true);
  assert.equal(s.total, 6);
});

test('hours filled only when all 24 slots are valid category ids', () => {
  assert.equal(item(dayStatus(emptyDay({ hours: full24(2) }), ctx()), 'hours').filled, true);
  const bad = full24(2);
  bad[5] = 99;
  assert.equal(item(dayStatus(emptyDay({ hours: bad }), ctx()), 'hours').filled, false);
  const gap = full24(2);
  gap[0] = null;
  assert.equal(item(dayStatus(emptyDay({ hours: gap }), ctx()), 'hours').filled, false);
});

test('climb is shown only with climbs and never counts', () => {
  const none = item(dayStatus(emptyDay(), ctx()), 'climb');
  assert.equal(none.shown, false);
  assert.equal(none.counts, false);
  const some = dayStatus(emptyDay({ climbs: 2 }), ctx());
  assert.equal(item(some, 'climb').shown, true);
  assert.equal(item(some, 'climb').counts, false);
  assert.equal(some.total, 6);
  assert.ok(!missingInOrder(some).includes('climb'));
});

test('sidequests: only count/timed, not completed, this year', () => {
  const milestone = dayStatus(emptyDay(), ctx({ sidequests: [{ id: 's', type: 'milestone', year: 2026 }] }));
  assert.equal(item(milestone, 'sidequests').counts, false);
  assert.equal(milestone.total, 5);
  const ignored = dayStatus(
    emptyDay(),
    ctx({
      sidequests: [
        { id: 'x', type: 'count', completedAt: '2026-01-01', year: 2026 },
        { id: 'y', type: 'timed', year: 2025 },
      ],
    }),
  );
  assert.equal(item(ignored, 'sidequests').counts, false);
  const timed = dayStatus(emptyDay({ sidequestLogIds: ['s1'] }), ctx({ sidequests: [{ id: 's1', type: 'timed', year: 2026 }] }));
  assert.equal(item(timed, 'sidequests').counts, true);
  assert.equal(item(timed, 'sidequests').filled, true);
});

test('mood, weight and highlight fill', () => {
  const s = dayStatus(emptyDay({ mood: 4, weight: 70, highlight: 'Good day' }), ctx());
  assert.equal(s.filled, 3);
  assert.equal(dayStatus(emptyDay({ highlight: '   ' }), ctx()).filled, 0);
});

test('missingInOrder keeps card order', () => {
  assert.deepEqual(missingInOrder(dayStatus(emptyDay(), ctx())), [
    'mood', 'habits', 'weight', 'sidequests', 'hours', 'highlight',
  ]);
  assert.deepEqual(missingInOrder(dayStatus(emptyDay({ mood: 3, weight: 70 }), ctx())), [
    'habits', 'sidequests', 'hours', 'highlight',
  ]);
});

test('templateKind reads the date as a local calendar date', () => {
  assert.equal(templateKind('2026-10-31'), 'weekend');
  assert.equal(templateKind('2026-11-01'), 'weekend');
  assert.equal(templateKind('2026-10-26'), 'weekday');
});

test('applyTemplate nulls invalid ids and handles null', () => {
  const tpl: Array<number | null> = [3, 99, ...Array.from({ length: 22 }, () => null)];
  const out = applyTemplate(tpl, [3]);
  assert.equal(out.length, 24);
  assert.deepEqual(out.slice(0, 3), [3, null, null]);
  assert.deepEqual(applyTemplate(null, [3]), Array.from({ length: 24 }, () => null));
});

test('parseTemplate accepts 24 ints or nulls only', () => {
  const ok = Array.from({ length: 24 }, (_, i) => (i % 2 ? null : i));
  assert.deepEqual(parseTemplate(ok), ok);
  assert.equal(parseTemplate(null), null);
  assert.equal(parseTemplate('x'), null);
  assert.equal(parseTemplate(ok.slice(0, 23)), null);
  assert.equal(parseTemplate([...ok, null]), null);
  assert.equal(parseTemplate(ok.map((v, i) => (i === 0 ? -1 : v))), null);
  assert.equal(parseTemplate(ok.map((v, i) => (i === 0 ? 1.5 : v))), null);
  assert.equal(parseTemplate(ok.map((v, i) => (i === 0 ? '3' : v))), null);
});
