import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayValueRows } from '../src/lib/sidequestDay.ts';

// Sheet rows: id, sidequestId, date, value, value2, note, milestoneIndex
const rows = [
  ['1', 'q1', '2026-10-27', '5', '', '', ''],
  ['2', 'q1', '2026-10-27', '', '', '', '0'],
  ['3', 'q2', '2026-10-27', '4', '', '', ''],
  ['4', 'q1', '2026-10-27', '3', '', '', ''],
  ['5', 'q1', '2026-10-28', '9', '', '', ''],
];

test('finds the value rows for one quest on one day (sheet row numbers)', () => {
  assert.deepEqual(dayValueRows(rows, 'q1', '2026-10-27'), [2, 5]);
});

test('skips milestone rows and other days', () => {
  assert.deepEqual(dayValueRows(rows, 'q1', '2026-10-28'), [6]);
  assert.deepEqual(dayValueRows(rows, 'q1', '2026-10-29'), []);
});
