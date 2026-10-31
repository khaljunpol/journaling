import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceClimb } from '../src/deviceClimb.ts';
import type { Log } from '../src/climbStats.ts';

// 2026-10-31 is a Saturday.
const today = '2026-10-31';
const log = (date: string, grade = '6a', session = 1): Log => ({ id: `${date}${grade}`, date, session, type: 'boulder', grade, attempts: 1 });

test('nothing logged: empty answers, no sentences', () => {
  assert.deepEqual(deviceClimb([], [], today), { sessions: 0, daysSince: null, hardest: null, weeks: 0, lines: [] });
});

test('sessions this week, days since, weeks in a row', () => {
  const logs = [log('2026-10-29'), log('2026-10-27'), log('2026-10-20'), log('2026-10-13')];
  const c = deviceClimb(logs, [], today);
  assert.equal(c.sessions, 2);
  assert.equal(c.daysSince, 2);
  assert.equal(c.weeks, 3);
  assert.deepEqual(c.lines, [{ text: '3 weeks of climbing in a row', tone: 'good' }]);
});

test('hardest send counts this year only', () => {
  const logs = [log('2025-06-01', 'V8'), log('2026-03-01', 'V5'), log('2026-04-01', 'V3')];
  assert.equal(deviceClimb(logs, [], today).hardest, 'V5');
});

test('a long gap reads as bad', () => {
  const c = deviceClimb([log('2026-10-10')], [], today);
  assert.deepEqual(c.lines, [{ text: '21 days since your last climb', tone: 'bad' }]);
});

test('a goal far behind reads as bad, and a finished one as good', () => {
  const goal = { year: 2026, type: 'boulder' as const, grade: '6a', target: 100 };
  const behind = deviceClimb([log('2026-10-29')], [goal], today);
  assert.ok(behind.lines.some((l) => l.tone === 'bad' && l.text === 'Behind on 6a goal: 1 of 100'));
  const done = deviceClimb([log('2026-10-29')], [{ ...goal, target: 1 }], today);
  assert.ok(done.lines.some((l) => l.tone === 'good' && l.text === '6a goal done: 1 of 1'));
});

test('a goal from another year says nothing', () => {
  const goal = { year: 2025, type: 'boulder' as const, grade: '6a', target: 100 };
  assert.deepEqual(deviceClimb([log('2026-10-29')], [goal], today).lines, []);
});

test('a future row is ignored', () => {
  assert.equal(deviceClimb([log('2026-11-05')], [], today).daysSince, null);
});
