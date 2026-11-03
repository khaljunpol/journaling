import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABS, HEADERS, range, dataRange, type TabKey } from '../src/sheetLayout.ts';

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

test('dataRange matches the ranges used today', () => {
  const expected: Record<TabKey, string> = {
    activities: "'Activities'!A2:D",
    logs: "'Logs'!A2:C",
    highlights: "'Highlights'!A2:B",
    weights: "'Weights'!A2:B",
    moods: "'Moods'!A2:B",
    climbs: "'Climbs'!A2:H",
    climbGoals: "'ClimbGoals'!A2:E",
    hours: "'Hours'!A2:Y",
    timeCategories: "'TimeCategories'!A2:E",
    sidequests: "'Sidequests'!A2:J",
    sidequestLogs: "'SidequestLogs'!A2:G",
    settings: "'Settings'!A2:B",
    dayLogs: "'DayLogs'!A2:C",
  };
  for (const tab of Object.keys(TABS) as TabKey[]) {
    assert.equal(dataRange(tab), expected[tab], tab);
  }
});

test('activities reads column D', () => {
  assert.deepEqual(HEADERS.activities, ['id', 'name', 'status', 'category']);
  assert.equal(dataRange('activities'), "'Activities'!A2:D");
});
