import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharePayload, STREAK_FILE, streakCardData } from '../src/lib/streakCard.ts';

const streak = { id: 'a', name: 'Gym', unit: 'days' as const, current: 14, best: 20, freezes: 1, usedFreezes: ['2026-10-01'] };

test('streakCardData: only name, streak, unit, best and level', () => {
  const d = streakCardData(streak, 25, false, false);
  assert.deepEqual(d, { title: 'Gym', streak: 14, unit: 'days', best: 20, level: 25 });
});

test('streakCardData: "My streak" when the name is hidden', () => {
  assert.equal(streakCardData(streak, 25, true, false)?.title, 'My streak');
});

test('streakCardData: a bad habit never gets a card', () => {
  assert.equal(streakCardData(streak, 25, false, true), null);
});

test('share: fixed file name and files only', () => {
  assert.equal(STREAK_FILE, 'streak-card.png');
  const file = { name: STREAK_FILE } as unknown as File;
  assert.deepEqual(Object.keys(sharePayload(file)), ['files']);
});
