import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceHistory, deviceState, deviceWeek, usualHoursFill } from '../src/deviceState.ts';
import { dayStatus, type DayData, type Ctx } from '../src/quickDay.ts';
import { habitIcon } from '../src/habitIcons.ts';

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
  const s = deviceState(day, ctx());
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
  const s = deviceState(
    emptyDay({ logs: [{ activityId: 'a', completed: true }, { activityId: 'b', completed: false }] }),
    ctx(),
  );
  assert.deepEqual(s.habits.map((h) => h.done), [true, false]);
});

test('hours counts non-null slots; mood and weight pass through', () => {
  const hours = Array.from({ length: 24 }, (_, i) => (i < 5 ? 1 : null));
  const s = deviceState(emptyDay({ hours, mood: 4, weight: 70.5 }), ctx());
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
  const { hoursFillReason } = await import('../src/deviceState.ts');
  const cats = [1, 2];
  const full = Array.from({ length: 24 }, () => 1);
  const tpl = { weekday: Array.from({ length: 24 }, () => 1), weekend: null };
  assert.equal(hoursFillReason(emptyDay(), { weekday: null, weekend: null }, cats), 'no_template');
  assert.equal(hoursFillReason(emptyDay({ hours: full }), tpl, cats), 'all_filled');
  assert.equal(hoursFillReason(emptyDay(), tpl, cats), null);
});

test('week: Monday to Sunday, past days scored, later days empty', () => {
  const mon = emptyDay({ date: '2026-10-26', mood: 7 });
  const wed = emptyDay({ date: '2026-10-28' });
  const days = { '2026-10-26': mon, '2026-10-27': emptyDay({ date: '2026-10-27' }), '2026-10-28': wed };
  const week = deviceWeek(days, ctx(), '2026-10-28');
  assert.deepEqual(week.map((d) => d.date), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  const st = dayStatus(mon, ctx());
  assert.deepEqual(week[0], { date: '2026-10-26', filled: st.filled, total: st.total });
  assert.deepEqual(week[3], { date: '2026-10-29', filled: 0, total: 0 });
});

test('week: a Sunday stays in the week that started on Monday', () => {
  const week = deviceWeek({}, ctx(), '2026-11-01');
  assert.equal(week[0].date, '2026-10-26');
  assert.equal(week[6].date, '2026-11-01');
});

test('history: 30 days, oldest first, ending today, gaps are null', () => {
  const days = { '2026-10-31': emptyDay({ date: '2026-10-31', mood: 7, weight: 80.5 }) };
  const h = deviceHistory(days, '2026-10-31');
  assert.equal(h.length, 30);
  assert.equal(h[0].date, '2026-10-02');
  assert.deepEqual(h[29], { date: '2026-10-31', mood: 7, weight: 80.5 });
  assert.deepEqual(h[0], { date: '2026-10-02', mood: null, weight: null });
});
