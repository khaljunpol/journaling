import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, groupOf, parseGroup, timeBalance } from '../src/timeBalance.ts';

test('groupOf uses the saved group first', () => {
  assert.equal(groupOf({ name: 'work', group: 'rest' }), 'rest');
  assert.equal(groupOf({ name: 'anything', group: 'none' }), null);
});

test('groupOf guesses the seven groups from common names', () => {
  const want: Record<string, string> = {
    sleep: 'sleep', nap: 'sleep',
    work: 'work', freelance: 'work', 'office meeting': 'work',
    kids: 'people', friends: 'people', party: 'people', family: 'people', partner: 'people',
    'leisure time': 'rest', gaming: 'rest', tv: 'rest',
    'exercise / sports': 'body', gym: 'body', climbing: 'body',
    'hobbies / projects': 'mind', 'language class': 'mind', study: 'mind',
    chores: 'admin', travel: 'admin', 'misc stuff': 'admin', commute: 'admin',
  };
  for (const [name, g] of Object.entries(want)) assert.equal(groupOf({ name }), g, name);
  assert.equal(groupOf({ name: 'xyz' }), null);
});

test('parseGroup keeps known groups and reads the old productive as work', () => {
  assert.equal(parseGroup('People '), 'people');
  assert.equal(parseGroup('productive'), 'work');
  assert.equal(parseGroup('none'), 'none');
  assert.equal(parseGroup(''), undefined);
  assert.equal(parseGroup('fun'), undefined);
});

test('timeBalance counts one hour per entry in each of the seven groups', () => {
  const cats = [
    { id: '0', name: 'sleep' }, { id: '1', name: 'work' }, { id: '5', name: 'friends' },
    { id: '9', name: 'gaming', group: 'mind' as const }, { id: '11', name: 'xyz' },
  ];
  const entries = [0, 0, 1, 1, 1, 5, 9, 11].map((category) => ({ category }));
  assert.deepEqual(timeBalance(entries, cats), { sleep: 2, work: 3, people: 1, rest: 0, body: 0, mind: 1, admin: 0 });
  assert.deepEqual(GROUPS.map((g) => g.id), ['sleep', 'work', 'people', 'rest', 'body', 'mind', 'admin']);
});
