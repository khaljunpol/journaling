import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insightInputFrom } from '../src/lib/server/insightInput.ts';

test('insightInputFrom drops non-array reads and keeps good rows', () => {
  const r = insightInputFrom({
    moods: [{ date: '2026-11-01', score: 7 }, null, 'x'],
    hours: null,
    logs: [{ date: '2026-11-01', activityId: 'g', completed: true }, { date: 5 }],
    activities: { not: 'an array' },
    cats: [{ id: '0', name: 'Sleep', color: '#00f' }],
  }, '2026-11-03');
  assert.equal(r.today, '2026-11-03');
  assert.deepEqual(r.moods, [{ date: '2026-11-01', score: 7 }]);
  assert.deepEqual(r.hours, []);
  assert.deepEqual(r.logs, [{ date: '2026-11-01', activityId: 'g', completed: true }]);
  assert.deepEqual(r.activities, []);
  assert.equal(r.cats.length, 1);
});
