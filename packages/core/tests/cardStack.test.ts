import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, cardsLeft, dotState, canAdvance } from '../src/cardStack.ts';

test('nextStep moves on and finishes at the end', () => {
  assert.deepEqual(nextStep(0, 3), { index: 1, finished: false });
  assert.deepEqual(nextStep(2, 3), { index: 3, finished: true });
  assert.deepEqual(nextStep(3, 3), { index: 3, finished: true });
});

test('cardsLeft counts the current card', () => {
  assert.equal(cardsLeft(0, 4), 4);
  assert.equal(cardsLeft(3, 4), 1);
  assert.equal(cardsLeft(4, 4), 0);
  assert.equal(cardsLeft(9, 4), 0);
});

test('dotState', () => {
  assert.equal(dotState(0, 1), 'done');
  assert.equal(dotState(1, 1), 'current');
  assert.equal(dotState(2, 1), 'todo');
});

test('canAdvance ignores taps during the slide', () => {
  assert.equal(canAdvance(100, 300), false);
  assert.equal(canAdvance(300, 300), true);
});
