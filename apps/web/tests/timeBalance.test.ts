import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOf, parseGroup, timeBalance } from '../src/lib/timeBalance.ts';

test('groupOf uses the saved group first', () => {
  assert.equal(groupOf({ name: 'work', group: 'rest' }), 'rest');
  assert.equal(groupOf({ name: 'anything', group: 'none' }), null);
});

test('groupOf guesses from the name when no group is saved', () => {
  assert.equal(groupOf({ name: 'Sleep' }), 'sleep');
  assert.equal(groupOf({ name: 'nap' }), 'sleep');
  assert.equal(groupOf({ name: 'work' }), 'productive');
  assert.equal(groupOf({ name: 'freelance' }), 'productive');
  assert.equal(groupOf({ name: 'hobbies / projects' }), 'productive');
  assert.equal(groupOf({ name: 'exercise' }), 'productive');
  assert.equal(groupOf({ name: 'productive / chores' }), 'productive');
  assert.equal(groupOf({ name: 'travel' }), 'productive');
  assert.equal(groupOf({ name: 'relaxation and leisure' }), 'rest');
  assert.equal(groupOf({ name: 'friends' }), 'rest');
  assert.equal(groupOf({ name: 'partner' }), 'rest');
  assert.equal(groupOf({ name: 'family' }), 'rest');
  assert.equal(groupOf({ name: 'brain rot / misc' }), 'rest');
  assert.equal(groupOf({ name: 'misc' }), null);
  assert.equal(groupOf({ name: 'commute' }), null);
});

test('parseGroup keeps only known groups', () => {
  assert.equal(parseGroup('Productive '), 'productive');
  assert.equal(parseGroup('none'), 'none');
  assert.equal(parseGroup(''), undefined);
  assert.equal(parseGroup('fun'), undefined);
});

test('timeBalance counts one hour per entry by group', () => {
  const cats = [
    { id: '0', name: 'sleep' },
    { id: '1', name: 'work' },
    { id: '5', name: 'friends' },
    { id: '9', name: 'gaming', group: 'productive' as const },
    { id: '11', name: 'misc' },
  ];
  const entries = [0, 0, 1, 1, 1, 5, 9, 11].map((category) => ({ category }));
  assert.deepEqual(timeBalance(entries, cats), { productive: 4, rest: 1, sleep: 2 });
  assert.deepEqual(timeBalance([{ category: '1' }], cats), { productive: 1, rest: 0, sleep: 0 });
});
