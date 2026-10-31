import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitIcon, doneHabits } from '../src/habitIcons.ts';

test('habitIcon reads the habit name', () => {
  assert.equal(habitIcon('Gym'), 'gym');
  assert.equal(habitIcon('Weights'), 'gym');
  assert.equal(habitIcon('Squash with Tom'), 'racket');
  assert.equal(habitIcon('Bouldering'), 'climb');
  assert.equal(habitIcon('Morning run'), 'run');
  assert.equal(habitIcon('Swim'), 'swim');
  assert.equal(habitIcon('Cycling'), 'bike');
  assert.equal(habitIcon('Yoga'), 'yoga');
  assert.equal(habitIcon('Drank beer'), 'beer');
  assert.equal(habitIcon('Wine'), 'wine');
  assert.equal(habitIcon('Read'), 'read');
  assert.equal(habitIcon('Coffee'), 'coffee');
  assert.equal(habitIcon('Drink water'), 'water');
  assert.equal(habitIcon('Meditate'), 'meditate');
  assert.equal(habitIcon('Smoked'), 'smoke');
  assert.equal(habitIcon('Guitar practice'), 'music');
  assert.equal(habitIcon('Journal'), 'write');
  assert.equal(habitIcon('Crossfit'), 'hiit');
  assert.equal(habitIcon('Push Up'), 'bodyweight');
  assert.equal(habitIcon('Padel'), 'racket');
  assert.equal(habitIcon('Alcohol'), 'beer');
  assert.equal(habitIcon('Creatine'), 'pill');
  assert.equal(habitIcon('Vitamins'), 'pill');
  assert.equal(habitIcon('Protein powder'), 'shake');
  assert.equal(habitIcon('Video games'), 'games');
  assert.equal(habitIcon('Date night'), 'heart');
  assert.equal(habitIcon('Update CV'), null); // "date" only as a whole word
  assert.equal(habitIcon('Brunch'), null); // "run" only as a whole word
  assert.equal(habitIcon('Call mom'), null);
});

const acts = [
  { id: 'g', name: 'Gym' },
  { id: 'b', name: 'Drank beer' },
  { id: 'm', name: 'Call mom' },
  { id: 'c', name: 'Climb' },
  { id: 'x', name: 'Read' },
];

test('doneHabits lists ticked habits in habit order, icon or not', () => {
  const logs = [
    { activityId: 'm', completed: true },
    { activityId: 'g', completed: true },
    { activityId: 'b', completed: true },
    { activityId: 'x', completed: false },
  ];
  assert.deepEqual(doneHabits(logs, acts, 0), [
    { id: 'g', label: 'Gym', icon: 'gym' },
    { id: 'b', label: 'Drank beer', icon: 'beer' },
    { id: 'm', label: 'Call mom', icon: null },
  ]);
});

test('climb logs add Climb once, even with a ticked climb habit', () => {
  assert.deepEqual(doneHabits([], acts, 3), [{ id: 'climb-logs', label: 'Climb', icon: 'climb' }]);
  assert.deepEqual(doneHabits([{ activityId: 'c', completed: true }], acts, 2), [{ id: 'c', label: 'Climb', icon: 'climb' }]);
});

test('logs for deleted habits are skipped', () => {
  assert.deepEqual(doneHabits([{ activityId: 'gone', completed: true }], acts, 0), []);
});
