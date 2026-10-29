import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetState, usualHoursFill } from '../src/lib/widgetState.ts';
import { dayStatus, type DayData, type Ctx } from '../src/lib/quickDay.ts';
import { habitIcon } from '../src/lib/habitIcons.ts';

const emptyDay = (over: Partial<DayData> = {}): DayData => ({
  date: '2026-10-26', // Monday
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
    { id: 'a', name: 'Read' },
    { id: 'b', name: 'Walk' },
  ],
  categoryIds: [1, 2, 3],
  sidequests: [],
  year: 2026,
  ...over,
});

test('empty day: nothing done, progress from dayStatus, icons set', () => {
  const day = emptyDay();
  const s = widgetState(day, ctx());
  const st = dayStatus(day, ctx());
  assert.equal(s.date, '2026-10-26');
  assert.equal(s.mood, null);
  assert.equal(s.weight, null);
  assert.equal(s.hours, 0);
  assert.deepEqual(s.progress, { filled: st.filled, total: st.total });
  assert.equal(s.progress.filled, 0);
  assert.ok(s.progress.total > 0);
  assert.deepEqual(
    s.habits,
    [
      { id: 'a', name: 'Read', icon: habitIcon('Read'), done: false },
      { id: 'b', name: 'Walk', icon: habitIcon('Walk'), done: false },
    ],
  );
});

test('habit done only when its log is completed', () => {
  const s = widgetState(
    emptyDay({ logs: [{ activityId: 'a', completed: true }, { activityId: 'b', completed: false }] }),
    ctx(),
  );
  assert.deepEqual(s.habits.map((h) => h.done), [true, false]);
});

test('hours counts non-null slots; mood and weight pass through', () => {
  const hours = Array.from({ length: 24 }, (_, i) => (i < 5 ? 1 : null));
  const s = widgetState(emptyDay({ hours, mood: 4, weight: 70.5 }), ctx());
  assert.equal(s.hours, 5);
  assert.equal(s.mood, 4);
  assert.equal(s.weight, 70.5);
});

const tpl = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 1 : 2));

test('usualHoursFill fills only empty slots', () => {
  const hours = Array.from({ length: 24 }, (_, i) => (i <= 8 ? 3 : null));
  const out = usualHoursFill(emptyDay({ hours }), { weekday: tpl, weekend: null }, [1, 2, 3]);
  assert.deepEqual(out, Array.from({ length: 15 }, (_, i) => ({ hour: 9 + i, category: tpl[9 + i] })));
});

test('usualHoursFill treats missing slots in a short array as empty', () => {
  const out = usualHoursFill(emptyDay({ hours: [3, 3] }), { weekday: tpl, weekend: null }, [1, 2, 3]);
  assert.equal(out.length, 22);
  assert.equal(out[0].hour, 2);
});

test('usualHoursFill: no template for that kind gives []', () => {
  assert.deepEqual(usualHoursFill(emptyDay(), { weekday: null, weekend: tpl }, [1, 2]), []);
  assert.deepEqual(usualHoursFill(emptyDay({ date: '2026-10-31' }), { weekday: tpl, weekend: null }, [1, 2]), []);
});

test('usualHoursFill uses the weekend template on Saturday', () => {
  const wk = Array.from({ length: 24 }, () => 2);
  const out = usualHoursFill(emptyDay({ date: '2026-10-31' }), { weekday: tpl, weekend: wk }, [2]);
  assert.equal(out.length, 24);
  assert.ok(out.every((e) => e.category === 2));
});

test('usualHoursFill skips ids not in categoryIds', () => {
  const out = usualHoursFill(emptyDay(), { weekday: tpl, weekend: null }, [1]);
  assert.equal(out.length, 12);
  assert.ok(out.every((e) => e.category === 1));
});

test('hoursFillReason: no template, all filled, or null when something can be written', async () => {
  const { hoursFillReason } = await import('../src/lib/widgetState.ts');
  const cats = [1, 2];
  const full = Array.from({ length: 24 }, () => 1);
  const tpl = { weekday: Array.from({ length: 24 }, () => 1), weekend: null };
  assert.equal(hoursFillReason(emptyDay(), { weekday: null, weekend: null }, cats), 'no_template');
  assert.equal(hoursFillReason(emptyDay({ hours: full }), tpl, cats), 'all_filled');
  assert.equal(hoursFillReason(emptyDay(), tpl, cats), null);
});
