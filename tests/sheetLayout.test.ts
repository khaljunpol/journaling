import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABS, HEADERS, range } from '../lib/sheetLayout.ts';

test('range quotes the tab name', () => {
  assert.equal(range('Logs', 'A2:C'), "'Logs'!A2:C");
});

test('range doubles apostrophes', () => {
  assert.equal(range("Jo's", 'A1'), "'Jo''s'!A1");
});

test('logs headers match the sheet today', () => {
  assert.deepEqual(HEADERS.logs, ['date', 'activityId', 'completed']);
});

test('hours has date plus 24 hour columns', () => {
  assert.equal(HEADERS.hours.length, 25);
  assert.equal(HEADERS.hours[24], 'h24');
});

test('every tab has headers', () => {
  for (const key of Object.keys(TABS)) {
    assert.ok(HEADERS[key as keyof typeof TABS]?.length > 0, key);
  }
});
