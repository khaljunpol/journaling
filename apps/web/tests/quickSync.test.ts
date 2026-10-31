import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncState } from '../src/lib/quickSync.ts';

test('empty queue is saved', () => {
  assert.equal(syncState([], true), 'saved');
});

test('pending items mean saving', () => {
  assert.equal(syncState([{ state: 'pending' }], true), 'saving');
});

test('a failed item wins over pending', () => {
  assert.equal(syncState([{ state: 'pending' }, { state: 'failed' }], true), 'failed');
});

test('storage that cannot persist is failed', () => {
  assert.equal(syncState([], false), 'failed');
});
