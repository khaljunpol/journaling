import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayStatus,
  missingInOrder,
  templateKind,
  applyTemplate,
  parseTemplate,
  parseHabitTemplate,
  initialTicks,
  type DayData,
  type Ctx,
} from '../src/quickDay.ts';

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

test('by default mood, habits, weight and hours count; quests and highlight are extras', () => {
  const s = dayStatus(emptyDay(), ctx());
  assert.equal(s.total, 4);
  assert.equal(item(s, 'sidequests').shown, true);
  assert.equal(item(s, 'sidequests').counts, false);
  assert.equal(item(s, 'highlight').shown, true);
  assert.equal(item(s, 'highlight').counts, false);
  assert.equal(s.filled, 0);
});

test('no activities and no quests gives total 3', () => {
  const s = dayStatus(emptyDay(), ctx({ activities: [], sidequests: [] }));
  assert.equal(s.total, 3);
  assert.deepEqual(
    [item(s, 'habits').shown, item(s, 'habits').counts, item(s, 'sidequests').shown, item(s, 'sidequests').counts],
    [false, false, false, false],
  );
});

test('habits filled when the day has at least one log row (true or false)', () => {
  const acts = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, name: `X${i}` }));
  const three = dayStatus(
    emptyDay({ logs: ['x0', 'x1', 'x2'].map((activityId) => ({ activityId, completed: true })) }),
    ctx({ activities: acts }),
  );
  assert.equal(item(three, 'habits').filled, true);
  const falseOnly = dayStatus(emptyDay({ logs: [{ activityId: 'a1', completed: false }] }), ctx());
  assert.equal(item(falseOnly, 'habits').filled, true);
  const none = dayStatus(emptyDay(), ctx());
  assert.equal(item(none, 'habits').filled, false);
});

test('an old stopped status still counts as a habit', () => {
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
  assert.equal(s.total, 4);
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
  assert.equal(some.total, 4);
  assert.ok(!missingInOrder(some).includes('climb'));
});

test('sidequests: only count/timed, not completed, this year', () => {
  const milestone = dayStatus(emptyDay(), ctx({ sidequests: [{ id: 's', type: 'milestone', year: 2026 }] }));
  assert.equal(item(milestone, 'sidequests').shown, false);
  assert.equal(milestone.total, 4);
  const ignored = dayStatus(
    emptyDay(),
    ctx({
      sidequests: [
        { id: 'x', type: 'count', completedAt: '2026-01-01', year: 2026 },
        { id: 'y', type: 'timed', year: 2025 },
      ],
    }),
  );
  assert.equal(item(ignored, 'sidequests').shown, false);
  const timed = dayStatus(emptyDay({ sidequestLogIds: ['s1'] }), ctx({ sidequests: [{ id: 's1', type: 'timed', year: 2026 }] }));
  assert.equal(item(timed, 'sidequests').shown, true);
  assert.equal(item(timed, 'sidequests').filled, true);
  // Picked in catch-up, an extra counts.
  const picked = dayStatus(emptyDay(), ctx(), { only: ['sidequests', 'highlight'] });
  assert.equal(picked.total, 2);
  assert.deepEqual(missingInOrder(picked), ['sidequests', 'highlight']);
});

test('mood, weight and highlight fill', () => {
  const s = dayStatus(emptyDay({ mood: 4, weight: 70, highlight: 'Good day' }), ctx());
  assert.equal(s.filled, 2);
  assert.equal(item(s, 'highlight').filled, true);
  assert.equal(item(dayStatus(emptyDay({ highlight: '   ' }), ctx()), 'highlight').filled, false);
});

test('missingInOrder keeps card order', () => {
  assert.deepEqual(missingInOrder(dayStatus(emptyDay(), ctx())), ['mood', 'habits', 'weight', 'hours']);
  assert.deepEqual(missingInOrder(dayStatus(emptyDay({ mood: 3, weight: 70 }), ctx())), ['habits', 'hours']);
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

test('dayStatus with only: unticked kinds are not counted', () => {
  const day = emptyDay({ mood: 3 });
  const all = dayStatus(day, ctx());
  const some = dayStatus(day, ctx(), { only: ['mood', 'weight'] });
  assert.equal(all.total, 4);
  assert.equal(some.total, 2);
  assert.equal(some.filled, 1);
  assert.deepEqual(missingInOrder(some), ['weight']);
  assert.equal(item(some, 'hours').counts, false);
  assert.equal(item(some, 'hours').shown, true);
});

test('dayStatus with only [] counts nothing', () => {
  const s = dayStatus(emptyDay(), ctx(), { only: [] });
  assert.equal(s.total, 0);
  assert.deepEqual(missingInOrder(s), []);
});

test('parseHabitTemplate: array of non-empty strings, max 100, else null', () => {
  assert.deepEqual(parseHabitTemplate(['a1', 'a2']), ['a1', 'a2']);
  assert.deepEqual(parseHabitTemplate([]), []);
  assert.equal(parseHabitTemplate(null), null);
  assert.equal(parseHabitTemplate('a1'), null);
  assert.equal(parseHabitTemplate(['a1', '']), null);
  assert.equal(parseHabitTemplate(['a1', 5]), null);
  assert.equal(parseHabitTemplate(Array.from({ length: 101 }, (_, i) => `x${i}`)), null);
  assert.equal(parseHabitTemplate(Array.from({ length: 100 }, (_, i) => `x${i}`))?.length, 100);
});

test('initialTicks: logs present -> logs; none -> template minus deleted ids (an old stopped status is ignored); no template -> none', () => {
  const acts = [
    { id: 'a1', name: 'Read' },
    { id: 'a2', name: 'Walk' },
    { id: 'a3', name: 'Old', status: 'stopped' },
  ];
  const withLogs = initialTicks([{ activityId: 'a2', completed: true }, { activityId: 'a1', completed: false }], ['a1'], acts);
  assert.deepEqual([...withLogs.ticked], ['a2']);
  assert.equal(withLogs.fromTemplate, false);
  const fromTpl = initialTicks([], ['a1', 'a3', 'gone'], acts);
  assert.deepEqual([...fromTpl.ticked], ['a1', 'a3']);
  assert.equal(fromTpl.fromTemplate, true);
  const none = initialTicks([], null, acts);
  assert.equal(none.ticked.size, 0);
  assert.equal(none.fromTemplate, false);
  const emptyTpl = initialTicks([], [], acts);
  assert.equal(emptyTpl.fromTemplate, false);
});

test('initialTicks: a template never ticks a bad habit', () => {
  const acts = [{ id: 'a', name: 'Gym' }, { id: 'b', name: 'Beer' }];
  assert.deepEqual([...initialTicks([], ['a', 'b'], acts).ticked], ['a']);
});

test('initialTicks: only bad habits on the template means no template', () => {
  assert.equal(initialTicks([], ['b'], [{ id: 'b', name: 'Beer' }]).fromTemplate, false);
});

test('initialTicks: a logged bad habit keeps its tick', () => {
  const r = initialTicks([{ activityId: 'b', completed: true }], ['a'], [{ id: 'b', name: 'Beer' }]);
  assert.deepEqual([...r.ticked], ['b']);
});

test('a day with only a bad tick still counts as logged', () => {
  const s = dayStatus(
    emptyDay({ logs: [{ activityId: 'b', completed: true }] }),
    ctx({ activities: [{ id: 'a', name: 'Gym' }, { id: 'b', name: 'Beer' }] }),
  );
  assert.equal(item(s, 'habits').filled, true);
});
