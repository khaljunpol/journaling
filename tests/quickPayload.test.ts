import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuickPayload } from '../src/lib/quickPayload.ts';

const empty = {
  activities: [], logs: [], moods: [], weights: [], highlights: [],
  hours: [], climbs: [], sidequests: [], sidequestLogs: [], categories: [],
};

test('every date in range is present, even empty', () => {
  const p = buildQuickPayload(
    { ...empty, moods: [{ date: '2026-10-26', score: 4 }] },
    '2026-10-25', '2026-10-27', {},
  );
  assert.deepEqual(Object.keys(p.days), ['2026-10-25', '2026-10-26', '2026-10-27']);
  assert.equal(p.days['2026-10-26'].mood, 4);
  assert.equal(p.days['2026-10-25'].mood, null);
  assert.equal(p.days['2026-10-25'].hours.length, 24);
  assert.equal(p.ctx.year, 2026);
  assert.equal(p.reminderEnabled, false);
});

test('duplicate rows: last wins', () => {
  const p = buildQuickPayload(
    {
      ...empty,
      logs: [
        { date: '2026-10-26', activityId: 'a', completed: true },
        { date: '2026-10-26', activityId: 'a', completed: false },
      ],
      moods: [{ date: '2026-10-26', score: 2 }, { date: '2026-10-26', score: 5 }],
    },
    '2026-10-26', '2026-10-26', {},
  );
  assert.deepEqual(p.days['2026-10-26'].logs, [{ activityId: 'a', completed: false }]);
  assert.equal(p.days['2026-10-26'].mood, 5);
});

test('hours map to 24 slots; categories, climbs, sidequest logs, highlights, weights', () => {
  const p = buildQuickPayload(
    {
      ...empty,
      hours: [{ date: '2026-10-26', hour: 3, category: 7 }],
      categories: [{ id: '7' }],
      climbs: [{ date: '2026-10-26' }, { date: '2026-10-26' }],
      sidequestLogs: [{ sidequestId: 'q1', date: '2026-10-26' }, { sidequestId: 'q1', date: '2026-10-26' }],
      highlights: [{ date: '2026-10-26', text: 'hi' }],
      weights: [{ date: '2026-10-26', weight: 70.5 }],
      sidequests: [{ id: 'q1', type: 'count', year: 2026 }],
    },
    '2026-10-26', '2026-10-26', {},
  );
  const d = p.days['2026-10-26'];
  assert.equal(d.hours[3], 7);
  assert.equal(d.hours[4], null);
  assert.deepEqual(p.ctx.categoryIds, [7]);
  assert.equal(d.climbs, 2);
  assert.deepEqual(d.sidequestLogIds, ['q1']);
  assert.equal(d.highlight, 'hi');
  assert.equal(d.weight, 70.5);
  assert.deepEqual(p.ctx.sidequests, [{ id: 'q1', type: 'count', completedAt: undefined, year: 2026 }]);
});

test('dates outside range are dropped', () => {
  const p = buildQuickPayload(
    { ...empty, moods: [{ date: '2026-10-20', score: 3 }], climbs: [{ date: '2026-11-01' }] },
    '2026-10-25', '2026-10-26', {},
  );
  assert.deepEqual(Object.keys(p.days), ['2026-10-25', '2026-10-26']);
  assert.equal(p.days['2026-10-25'].mood, null);
  assert.equal(p.days['2026-10-26'].climbs, 0);
});

test('templates parse from settings; reminder is 1/0; no push subscription', () => {
  const tpl = Array.from({ length: 24 }, () => 1);
  const p = buildQuickPayload(empty, '2026-10-26', '2026-10-26', {
    hourTemplateWeekday: JSON.stringify(tpl),
    hourTemplateWeekend: 'not json',
    reminderEnabled: '1',
    pushSubscription: 'secret',
  });
  assert.deepEqual(p.templates.weekday, tpl);
  assert.equal(p.templates.weekend, null);
  assert.equal(p.reminderEnabled, true);
  assert.equal(JSON.stringify(p).includes('secret'), false);
});
