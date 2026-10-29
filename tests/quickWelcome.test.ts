import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welcomeSteps, showWelcome } from '../src/lib/quickWelcome.ts';
import type { QuickPayload } from '../src/lib/quickPayload.ts';

const TODAY = '2026-10-29';
const day = (date: string, over = {}) => ({
  date, mood: null, weight: null, highlight: '', logs: [],
  hours: Array.from({ length: 24 }, () => null), climbs: 0, sidequestLogIds: [], ...over,
});
const payload = (over: { activities?: Array<{ id: string; name: string }>; today?: object; reminder?: boolean } = {}): QuickPayload => ({
  ctx: { activities: over.activities ?? [], categoryIds: [1], sidequests: [], year: 2026 },
  days: { '2026-10-28': day('2026-10-28'), [TODAY]: day(TODAY, over.today ?? {}) },
  templates: { weekday: null, weekend: null },
  habitTemplates: { weekday: null, weekend: null },
  reminderEnabled: over.reminder ?? false,
});

test('a brand-new sheet sees the welcome with nothing done', () => {
  const p = payload();
  assert.deepEqual(welcomeSteps(p, TODAY), [
    { key: 'habits', done: false },
    { key: 'log', done: false },
    { key: 'reminder', done: false },
  ]);
  assert.equal(showWelcome(p, TODAY, false), true);
});

test('steps tick as they get done', () => {
  const p = payload({ activities: [{ id: 'a', name: 'Read' }], today: { mood: 7 }, reminder: true });
  assert.deepEqual(welcomeSteps(p, TODAY).map((s) => s.done), [true, true, true]);
});

test('hidden once dismissed', () => {
  assert.equal(showWelcome(payload(), TODAY, true), false);
});

test('hidden for someone who has habits and logged data', () => {
  const p = payload({ activities: [{ id: 'a', name: 'Read' }], today: { mood: 7 } });
  assert.equal(showWelcome(p, TODAY, false), false);
});

test('still shown with habits but no data anywhere yet', () => {
  const p = payload({ activities: [{ id: 'a', name: 'Read' }] });
  assert.equal(showWelcome(p, TODAY, false), true);
});

test('any logged item counts as data: hours, climbs, a habit row', () => {
  const acts = [{ id: 'a', name: 'Read' }];
  const hours = Array.from({ length: 24 }, (_, i) => (i === 3 ? 1 : null));
  assert.equal(showWelcome(payload({ activities: acts, today: { hours } }), TODAY, false), false);
  assert.equal(showWelcome(payload({ activities: acts, today: { climbs: 1 } }), TODAY, false), false);
  assert.equal(showWelcome(payload({ activities: acts, today: { logs: [{ activityId: 'a', completed: false }] } }), TODAY, false), false);
});
