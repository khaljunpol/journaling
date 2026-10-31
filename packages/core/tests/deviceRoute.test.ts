import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeviceAction } from '../src/deviceState.ts';

test('parseDeviceAction accepts the 4 shapes', () => {
  assert.deepEqual(parseDeviceAction({ action: 'mood', score: 0 }), { kind: 'mood', score: 0 });
  assert.deepEqual(parseDeviceAction({ action: 'mood', score: 10 }), { kind: 'mood', score: 10 });
  assert.deepEqual(parseDeviceAction({ action: 'habit', activityId: 'abc' }), { kind: 'habit', activityId: 'abc' });
  assert.deepEqual(parseDeviceAction({ action: 'weight', weight: 72.4 }), { kind: 'weight', weight: 72.4 });
  assert.deepEqual(parseDeviceAction({ action: 'weight', weight: 20 }), { kind: 'weight', weight: 20 });
  assert.deepEqual(parseDeviceAction({ action: 'weight', weight: 400 }), { kind: 'weight', weight: 400 });
  assert.deepEqual(parseDeviceAction({ action: 'hours', fill: 'usual' }), { kind: 'hours' });
  assert.deepEqual(parseDeviceAction({ action: 'hours' }), { kind: 'hours' });
});

test('parseDeviceAction rejects bad mood scores', () => {
  for (const score of [11, -1, 6.5, '7', null, NaN, Infinity]) {
    assert.equal(parseDeviceAction({ action: 'mood', score }), null, String(score));
  }
  assert.equal(parseDeviceAction({ action: 'mood' }), null);
});

test('parseDeviceAction rejects bad weights', () => {
  for (const weight of [10, 19.9, 400.1, '70', null, NaN, Infinity]) {
    assert.equal(parseDeviceAction({ action: 'weight', weight }), null, String(weight));
  }
  assert.equal(parseDeviceAction({ action: 'weight' }), null);
});

test('parseDeviceAction rejects bad habit ids', () => {
  assert.equal(parseDeviceAction({ action: 'habit' }), null);
  assert.equal(parseDeviceAction({ action: 'habit', activityId: '' }), null);
  assert.equal(parseDeviceAction({ action: 'habit', activityId: '   ' }), null);
  assert.equal(parseDeviceAction({ action: 'habit', activityId: 5 }), null);
  assert.equal(parseDeviceAction({ action: 'habit', activityId: 'x'.repeat(101) }), null);
  assert.deepEqual(parseDeviceAction({ action: 'habit', activityId: 'x'.repeat(100) }), { kind: 'habit', activityId: 'x'.repeat(100) });
});

test('parseDeviceAction rejects junk', () => {
  for (const body of ['x', null, undefined, 5, [], {}, { action: 'x' }, { action: 'hours', fill: 'all' }, { score: 5 }]) {
    assert.equal(parseDeviceAction(body), null, JSON.stringify(body));
  }
});

import { pickEmptyEntries } from '../src/deviceState.ts';

test('pickEmptyEntries keeps only hours whose cell is empty', () => {
  const row = new Array(24).fill('');
  row[1] = '3';
  row[2] = '0'; // 0 is a real category, not empty
  const entries = [
    { hour: 0, category: 1 },
    { hour: 1, category: 1 },
    { hour: 2, category: 1 },
    { hour: 3, category: 2 },
  ];
  assert.deepEqual(pickEmptyEntries(row, entries), [
    { hour: 0, category: 1 },
    { hour: 3, category: 2 },
  ]);
  assert.deepEqual(pickEmptyEntries(row, []), []);
});

test('pickEmptyEntries treats whitespace and missing cells as empty', () => {
  const row = [' ', '2'];
  assert.deepEqual(pickEmptyEntries(row, [{ hour: 0, category: 1 }, { hour: 1, category: 1 }, { hour: 5, category: 1 }]), [
    { hour: 0, category: 1 },
    { hour: 5, category: 1 },
  ]);
});
