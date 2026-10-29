import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysISO,
  mondayOf,
  weekDates,
  weekRange,
  shiftWeek,
  canGoNext,
  datesUpTo,
  CATCHUP_KINDS,
  sanitizeChoice,
  toggleKind,
  onlyFor,
  catchUpSteps,
  templateFillPlan,
  templateMessage,
  habitFillPlan,
  habitMessage,
} from '../src/lib/quickWeek.ts';

const empty = Array.from({ length: 24 }, () => null);

test('addDaysISO crosses month, year and DST', () => {
  assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysISO('2026-01-01', -1), '2025-12-31');
  assert.equal(addDaysISO('2026-03-29', 1), '2026-03-30');
});

test('mondayOf gives the Monday of the week', () => {
  assert.equal(mondayOf('2026-10-26'), '2026-10-26'); // Monday
  assert.equal(mondayOf('2026-10-27'), '2026-10-26');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26'); // Sunday
  assert.equal(mondayOf('2026-01-01'), '2025-12-29');
});

test('weekDates lists Mon to Sun', () => {
  const d = weekDates('2026-10-26');
  assert.equal(d.length, 7);
  assert.equal(d[0], '2026-10-26');
  assert.equal(d[6], '2026-11-01');
});

test('weekRange stops at today and is at most 7 days', () => {
  assert.deepEqual(weekRange('2026-10-12', '2026-10-27'), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(weekRange('2026-10-26', '2026-10-28'), { from: '2026-10-26', to: '2026-10-28' });
});

test('shiftWeek moves by weeks and never past the current week', () => {
  assert.equal(shiftWeek('2026-10-26', -1, '2026-10-27'), '2026-10-19');
  assert.equal(shiftWeek('2026-10-26', 1, '2026-10-27'), '2026-10-26');
  assert.equal(shiftWeek('2026-10-19', 1, '2026-10-27'), '2026-10-26');
});

test('canGoNext is false on the current week', () => {
  assert.equal(canGoNext('2026-10-26', '2026-10-27'), false);
  assert.equal(canGoNext('2026-10-19', '2026-10-27'), true);
});

test('datesUpTo drops days after today', () => {
  assert.deepEqual(datesUpTo(weekDates('2026-10-26'), '2026-10-28'), ['2026-10-26', '2026-10-27', '2026-10-28']);
  assert.equal(datesUpTo(weekDates('2026-10-12'), '2026-10-28').length, 7);
});

test('sanitizeChoice defaults to the daily kinds and drops junk', () => {
  assert.deepEqual(sanitizeChoice(null), ['mood', 'habits', 'weight', 'hours']);
  assert.deepEqual(sanitizeChoice('x'), ['mood', 'habits', 'weight', 'hours']);
  assert.equal(CATCHUP_KINDS.length, 6);
  assert.deepEqual(sanitizeChoice(['hours', 'mood', 'nope', 'mood']), ['mood', 'hours']);
  assert.deepEqual(sanitizeChoice([]), []);
});

test('toggleKind adds and removes, keeping order', () => {
  assert.deepEqual(toggleKind(['mood', 'hours'], 'weight'), ['mood', 'weight', 'hours']);
  assert.deepEqual(toggleKind(['mood', 'hours'], 'mood'), ['hours']);
});

test('onlyFor limits old days only', () => {
  const choice = ['mood' as const];
  assert.deepEqual(onlyFor('2026-10-20', '2026-10-26', choice), choice);
  assert.equal(onlyFor('2026-10-26', '2026-10-26', choice), undefined);
  assert.equal(onlyFor('2026-10-27', '2026-10-26', choice), undefined);
});

test('catchUpSteps goes oldest to newest, only ticked, skips empty days and the future', () => {
  const days = [
    { date: '2026-10-14', missing: ['mood', 'habits', 'hours'] as const },
    { date: '2026-10-13', missing: ['weight'] as const },
    { date: '2026-10-15', missing: [] as const },
    { date: '2026-10-16', missing: ['highlight'] as const },
    { date: '2026-10-17', missing: ['mood'] as const },
  ].map((d) => ({ date: d.date, missing: [...d.missing] }));
  const steps = catchUpSteps(days, '2026-10-16', ['mood', 'hours', 'highlight']);
  assert.deepEqual(steps, [
    { date: '2026-10-14', key: 'mood' },
    { date: '2026-10-14', key: 'hours' },
    { date: '2026-10-16', key: 'highlight' },
  ]);
});

test('templateFillPlan fills only fully empty days up to today', () => {
  const wd = Array.from({ length: 24 }, (_, i) => (i < 8 ? 1 : 2));
  const days = [
    { date: '2026-10-19', hours: empty }, // Mon, empty
    { date: '2026-10-20', hours: wd.map((h, i) => (i === 3 ? h : null)) }, // has some
    { date: '2026-10-24', hours: empty }, // Sat, empty
    { date: '2026-10-28', hours: empty }, // future
  ];
  const plan = templateFillPlan(days, '2026-10-26', { weekday: wd, weekend: null }, [1, 2]);
  assert.deepEqual(plan.fills.map((f) => f.date), ['2026-10-19']);
  assert.equal(plan.fills[0].hours[0], 1);
  assert.deepEqual(plan.missingKinds, ['weekend']);
  assert.equal(plan.skippedHasHours, 1);
});

test('templateFillPlan treats a template of unknown categories as missing', () => {
  const plan = templateFillPlan([{ date: '2026-10-19', hours: empty }], '2026-10-26', { weekday: [9, ...empty.slice(1)], weekend: null }, [1]);
  assert.equal(plan.fills.length, 0);
  assert.deepEqual(plan.missingKinds, ['weekday']);
});

test('templateMessage is calm and specific', () => {
  const f = (n: number) => Array.from({ length: n }, (_, i) => ({ date: `d${i}`, hours: [] }));
  assert.equal(templateMessage({ fills: f(2), missingKinds: [], skippedHasHours: 0 }), 'Filled hours for 2 days.');
  assert.equal(templateMessage({ fills: f(1), missingKinds: ['weekend'], skippedHasHours: 0 }), 'Filled hours for 1 day. No weekend template yet.');
  assert.equal(templateMessage({ fills: [], missingKinds: ['weekend'], skippedHasHours: 0 }), 'No weekend template yet.');
  assert.equal(templateMessage({ fills: [], missingKinds: ['weekday', 'weekend'], skippedHasHours: 0 }), 'No templates yet.');
  assert.equal(templateMessage({ fills: [], missingKinds: [], skippedHasHours: 3 }), 'Every day already has hours.');
});

const acts = [{ id: 'a', status: 'active' }, { id: 'b' }, { id: 'c', status: 'stopped' }];

test('habitFillPlan fills empty days up to today with true/false per habit', () => {
  const days = [
    { date: '2026-10-19', logs: [] }, // Mon, empty
    { date: '2026-10-20', logs: [{ activityId: 'a', completed: false }] }, // has a row
    { date: '2026-10-28', logs: [] }, // future
  ];
  const plan = habitFillPlan(days, '2026-10-26', { weekday: ['a', 'c'], weekend: null }, acts);
  assert.deepEqual(plan.fills.map((f) => f.date), ['2026-10-19']);
  assert.deepEqual(plan.fills[0].rows, [
    { activityId: 'a', completed: true },
    { activityId: 'b', completed: false },
    { activityId: 'c', completed: true },
  ]);
  assert.deepEqual(plan.missingKinds, []);
  assert.equal(plan.skippedHasLogs, 1);
});

test('habitFillPlan names a missing template and skips those days', () => {
  const days = [
    { date: '2026-10-24', logs: [] }, // Sat
    { date: '2026-10-19', logs: [] }, // Mon
  ];
  const plan = habitFillPlan(days, '2026-10-26', { weekday: ['a'], weekend: null }, acts);
  assert.deepEqual(plan.fills.map((f) => f.date), ['2026-10-19']);
  assert.deepEqual(plan.missingKinds, ['weekend']);
});

test('habitFillPlan treats a template of only deleted habits as missing; an old stopped one still fills', () => {
  const plan = habitFillPlan([{ date: '2026-10-19', logs: [] }], '2026-10-26', { weekday: ['gone'], weekend: null }, acts);
  assert.equal(plan.fills.length, 0);
  const stopped = habitFillPlan([{ date: '2026-10-19', logs: [] }], '2026-10-26', { weekday: ['c'], weekend: null }, acts);
  assert.equal(stopped.fills.length, 1);
  assert.deepEqual(plan.missingKinds, ['weekday']);
});

test('habitMessage is calm and specific', () => {
  const f = (n: number) => Array.from({ length: n }, (_, i) => ({ date: `d${i}`, rows: [] }));
  assert.equal(habitMessage({ fills: f(4), missingKinds: [], skippedHasLogs: 0 }), 'Filled habits for 4 days.');
  assert.equal(
    habitMessage({ fills: f(1), missingKinds: ['weekend'], skippedHasLogs: 0 }),
    'Filled habits for 1 day. No usual weekend habits yet. Set them on Time categories.',
  );
  assert.equal(habitMessage({ fills: [], missingKinds: ['weekend'], skippedHasLogs: 0 }), 'No usual weekend habits yet. Set them on Time categories.');
  assert.equal(habitMessage({ fills: [], missingKinds: ['weekday', 'weekend'], skippedHasLogs: 0 }), 'No usual habits yet. Set them on Time categories.');
  assert.equal(habitMessage({ fills: [], missingKinds: [], skippedHasLogs: 3 }), 'Every day already has habits.');
});
