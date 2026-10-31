import test from 'node:test';
import assert from 'node:assert/strict';
import { applyQueue, applyQueueItem, itemsForTile } from '../src/quickApply.ts';
import type { QuickPayload } from '../src/quickPayload.ts';

const day = (date: string) => ({
  date, mood: null, weight: null, highlight: '', logs: [],
  hours: Array.from({ length: 24 }, () => null), climbs: 0, sidequestLogIds: [],
});
const base = (): QuickPayload => ({
  ctx: { activities: [], categoryIds: [1], sidequests: [], year: 2026 },
  days: { '2026-10-27': day('2026-10-27') },
  templates: { weekday: null, weekend: null },
  habitTemplates: { weekday: null, weekend: null },
  reminderEnabled: false,
});
const q = (key: string, body: unknown) => ({ key, body, state: 'pending' as const });

test('applies mood, weight, highlight', () => {
  const p = applyQueue(base(), [
    q('mood:2026-10-27', { score: 7 }),
    q('weight:2026-10-27', { weight: 72.4 }),
    q('highlight:2026-10-27', { text: 'hi' }),
  ]);
  assert.equal(p.days['2026-10-27'].mood, 7);
  assert.equal(p.days['2026-10-27'].weight, 72.4);
  assert.equal(p.days['2026-10-27'].highlight, 'hi');
});

test('applies log, hours and side quest', () => {
  let p = applyQueueItem(base(), q('log:2026-10-27:a1', { completed: true }));
  p = applyQueueItem(p, q('log:2026-10-27:a1', { completed: false }));
  assert.deepEqual(p.days['2026-10-27'].logs, [{ activityId: 'a1', completed: false }]);
  p = applyQueueItem(p, q('hours:2026-10-27', { entries: [{ hour: 3, category: 1 }] }));
  assert.equal(p.days['2026-10-27'].hours[3], 1);
  p = applyQueueItem(p, q('sq:2026-10-27:s1', { value: 2 }));
  assert.deepEqual(p.days['2026-10-27'].sidequestLogIds, ['s1']);
  assert.deepEqual(p.days['2026-10-27'].sidequestValues, { s1: 2 });
  p = applyQueueItem(p, q('sq:2026-10-27:s1', { value: 4, replace: true }));
  assert.deepEqual(p.days['2026-10-27'].sidequestValues, { s1: 4 });
});

test('unknown day or key leaves payload alone', () => {
  const b = base();
  assert.equal(applyQueueItem(b, q('mood:2020-01-01', { score: 1 })), b);
  assert.equal(applyQueueItem(b, q('zzz:2026-10-27', {})), b);
});

test('itemsForTile matches by date', () => {
  const items = [q('log:2026-10-27:a', {}), q('log:2026-10-26:a', {}), q('mood:2026-10-27', {})];
  assert.equal(itemsForTile(items, 'habits', '2026-10-27').length, 1);
  assert.equal(itemsForTile(items, 'mood', '2026-10-27').length, 1);
});

import { hoursEntries, pruneDays } from '../src/quickApply.ts';

test('hoursEntries drops empty slots', () => {
  const h: Array<number | null> = Array.from({ length: 24 }, () => null);
  h[2] = 5;
  h[9] = 1;
  assert.deepEqual(hoursEntries(h), [{ hour: 2, category: 5 }, { hour: 9, category: 1 }]);
  assert.deepEqual(hoursEntries(h.map(() => null)), []);
});

test('pruneDays keeps recent days only', () => {
  const p = base();
  p.days['2026-09-01'] = day('2026-09-01');
  p.days['2026-10-10'] = day('2026-10-10');
  const out = pruneDays(p, '2026-10-27');
  assert.deepEqual(Object.keys(out.days).sort(), ['2026-10-10', '2026-10-27']);
});
