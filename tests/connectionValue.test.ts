import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeConnection, decodeConnection, connectionFor } from '../lib/server/connectionValue.ts';

test('round trip lowercases the email', () => {
  const raw = encodeConnection({ id: 'abc_123', mode: 'robot', email: 'A@B.C' });
  assert.deepEqual(decodeConnection(raw), { id: 'abc_123', mode: 'robot', email: 'a@b.c' });
});

test('legacy bare id reads as robot with no email', () => {
  assert.deepEqual(decodeConnection('abc_123'), { id: 'abc_123', mode: 'robot', email: null });
});

test('connectionFor rejects another email, accepts legacy', () => {
  const other = { id: 'abc', mode: 'robot' as const, email: 'x@y.z' };
  assert.equal(connectionFor(other, 'a@b.c'), null);
  const legacy = { id: 'abc', mode: 'robot' as const, email: null };
  assert.deepEqual(connectionFor(legacy, 'a@b.c'), legacy);
  assert.deepEqual(connectionFor(other, ' X@Y.Z '), other);
});

test('bad values decode to null', () => {
  assert.equal(decodeConnection('{bad'), null);
  assert.equal(decodeConnection('a/b'), null);
  assert.equal(decodeConnection(undefined), null);
});
