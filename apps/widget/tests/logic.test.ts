import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connFromCode } from '../src/logic/api.ts';
import { applyLocal, enqueue, remove, sendable, shownHabits, shownHistory, shownWeek, sparkPoints } from '../src/logic/queue.ts';

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

test('a habit done outside the picked ones takes the last slot that is not done', () => {
  const h = (id: string, done = false) => ({ id, done });
  const habits = [h('a', true), h('b'), h('c'), h('d', true)];
  assert.deepEqual(shownHabits(habits, ['a', 'b', 'c'], 3).map((x) => x.id), ['a', 'b', 'd']);
});

test('done habits never push out other done ones', () => {
  const h = (id: string, done = false) => ({ id, done });
  const habits = [h('a', true), h('b', true), h('c', true)];
  assert.deepEqual(shownHabits(habits, ['a', 'b'], 2).map((x) => x.id), ['a', 'b']);
});

test('nothing done: the picked habits stay as they are', () => {
  const h = (id: string) => ({ id, done: false });
  assert.deepEqual(shownHabits([h('a'), h('b'), h('c')], ['c', 'a'], 4).map((x) => x.id), ['c', 'a']);
});

test('week: today follows the live progress, other days come from the server', () => {
  const week = [{ date: '2026-10-26', filled: 4, total: 4 }, { date: '2026-10-31', filled: 0, total: 4 }];
  const shown = shownWeek(week, { ...state, progress: { filled: 3, total: 4 } });
  assert.equal(shown.length, 7);
  assert.deepEqual(shown[0], { date: '2026-10-26', filled: 4, total: 4 });
  assert.deepEqual(shown[5], { date: '2026-10-31', filled: 3, total: 4 });
  assert.deepEqual(shown[1], { date: '2026-10-27', filled: 0, total: 0 });
});

test('week: nothing saved, or last week saved, still gives this week', () => {
  assert.equal(shownWeek(null, state)[0].date, '2026-10-26');
  const old = [{ date: '2026-10-19', filled: 4, total: 4 }];
  assert.ok(shownWeek(old, state).every((d) => d.date >= '2026-10-26'));
});

test('history: 30 days ending today, and today follows the live values', () => {
  const saved = [{ date: '2026-10-30', mood: 5, weight: 81 }, { date: '2026-10-31', mood: 2, weight: 90 }];
  const shown = shownHistory(saved, { ...state, mood: 8, weight: 80 });
  assert.equal(shown.length, 30);
  assert.deepEqual(shown[28], { date: '2026-10-30', mood: 5, weight: 81 });
  assert.deepEqual(shown[29], { date: '2026-10-31', mood: 8, weight: 80 });
  assert.equal(shownHistory(null, state)[0].date, '2026-10-02');
});

test('spark: lowest value at the bottom, gaps skipped', () => {
  assert.deepEqual(sparkPoints([80, null, 90], 100, 20), [{ x: 0, y: 20 }, { x: 100, y: 0 }]);
});

test('spark: one value or equal values sit in the middle', () => {
  assert.deepEqual(sparkPoints([null, 80], 100, 20), [{ x: 100, y: 10 }]);
  assert.deepEqual(sparkPoints([80, 80], 100, 20), [{ x: 0, y: 10 }, { x: 100, y: 10 }]);
});

test('spark: nothing to draw', () => {
  assert.deepEqual(sparkPoints([null, null], 100, 20), []);
});
