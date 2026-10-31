import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connFromCode } from '../src/logic/api.ts';
import { applyLocal, enqueue, remove, sendable, shownHabits } from '../src/logic/queue.ts';

const state = {
  date: '2026-10-31', mood: null, weight: null, hours: 3, highlight: '', progress: { filled: 0, total: 4 },
  habits: [{ id: 'a', name: 'Gym', icon: 'gym' as const, done: false }, { id: 'b', name: 'Read', icon: 'read' as const, done: false }],
};
const code = (v: unknown) => btoa(JSON.stringify(v));

test('connFromCode reads a good code and strips a trailing slash', () => {
  assert.deepEqual(connFromCode(code({ url: 'https://x.app/', key: 'id.secret' })), { url: 'https://x.app', key: 'id.secret' });
});

test('connFromCode refuses junk', () => {
  assert.equal(connFromCode('junk'), null);
  assert.equal(connFromCode(code({ url: 'https://x.app' })), null);
  assert.equal(connFromCode(code({ url: 'ftp://x', key: 'k' })), null);
});

test('applyLocal draws each tap at once; hours wait for the server', () => {
  assert.equal(applyLocal(state, { action: 'mood', score: 7 }).mood, 7);
  assert.equal(applyLocal(state, { action: 'weight', weight: 81.2 }).weight, 81.2);
  assert.deepEqual(applyLocal(state, { action: 'habit', activityId: 'b' }).habits.map((h) => h.done), [false, true]);
  assert.equal(applyLocal(state, { action: 'hours' }).hours, 3);
});

test('queue keeps order, and a repeat replaces the waiting tap', () => {
  let q = enqueue([], { id: '1', action: { action: 'mood', score: 5 }, date: 'd' });
  q = enqueue(q, { id: '2', action: { action: 'habit', activityId: 'a' }, date: 'd' });
  q = enqueue(q, { id: '3', action: { action: 'habit', activityId: 'b' }, date: 'd' });
  q = enqueue(q, { id: '4', action: { action: 'mood', score: 8 }, date: 'd' });
  assert.deepEqual(q.map((x) => x.id), ['2', '3', '4']);
  assert.deepEqual(remove(q, '3').map((x) => x.id), ['2', '4']);
});

test('sendable drops taps made for another day', () => {
  const q = [
    { id: '1', action: { action: 'hours' as const }, date: '2026-10-30' },
    { id: '2', action: { action: 'hours' as const }, date: '2026-10-31' },
  ];
  assert.deepEqual(sendable(q, '2026-10-31').map((x) => x.id), ['2']);
});

test('shownHabits follows the picked order, skips deleted ones, falls back to all', () => {
  assert.deepEqual(shownHabits(state.habits, ['b', 'gone', 'a'], 4).map((h) => h.id), ['b', 'a']);
  assert.deepEqual(shownHabits(state.habits, [], 1).map((h) => h.id), ['a']);
});

test('applyLocal unticks a habit and sets the highlight', () => {
  const on = applyLocal(state, { action: 'habit', activityId: 'a' });
  assert.equal(on.habits[0].done, true);
  assert.equal(applyLocal(on, { action: 'habit', activityId: 'a', done: false }).habits[0].done, false);
  assert.equal(applyLocal(state, { action: 'highlight', text: 'Good day' }).highlight, 'Good day');
});

test('ticking then unticking while offline keeps only the last tap', () => {
  let q = enqueue([], { id: '1', action: { action: 'habit', activityId: 'a', done: true }, date: 'd' });
  q = enqueue(q, { id: '2', action: { action: 'habit', activityId: 'a', done: false }, date: 'd' });
  assert.deepEqual(q.map((x) => x.id), ['2']);
});
