import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSecret, hashSecret, secretMatches, parseKey, encodeCode, decodeCode } from '../src/lib/deviceKey.ts';

test('make, hash, matches round trip', () => {
  const s = makeSecret();
  assert.match(s, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(s, makeSecret());
  const h = hashSecret(s);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(secretMatches(h, s), true);
});

test('wrong secret does not match', () => {
  const h = hashSecret(makeSecret());
  assert.equal(secretMatches(h, makeSecret()), false);
});

test('bad hash never matches', () => {
  const s = makeSecret();
  assert.equal(secretMatches('', s), false);
  assert.equal(secretMatches('abc123', s), false);
  assert.equal(secretMatches('z'.repeat(64), s), false);
});

test('parseKey splits on the last dot', () => {
  assert.deepEqual(parseKey('abc_D-1.s3cr3t'), { spreadsheetId: 'abc_D-1', secret: 's3cr3t' });
});

test('parseKey rejects bad keys', () => {
  assert.equal(parseKey('no-dot'), null);
  assert.equal(parseKey('.x'), null);
  assert.equal(parseKey('a b.x'), null);
  assert.equal(parseKey('abc.'), null);
});

test('encodeCode and decodeCode round trip', () => {
  const u = 'https://example.com';
  const k = 'sheetId.secret';
  assert.deepEqual(decodeCode(encodeCode(u, k)), { url: u, key: k });
});

test('decodeCode rejects junk', () => {
  assert.equal(decodeCode('junk'), null);
  assert.equal(decodeCode(Buffer.from('{"url":"x"}').toString('base64')), null);
  assert.equal(decodeCode(Buffer.from('{"url":"","key":"k"}').toString('base64')), null);
});

import { keyLooksValid, makeReadGate } from '../src/lib/deviceKey.ts';

test('keyLooksValid: only real-shaped ids and secrets', () => {
  const id = 'a'.repeat(44);
  const secret = makeSecret();
  assert.equal(secret.length, 43);
  assert.equal(keyLooksValid({ spreadsheetId: id, secret }), true);
  assert.equal(keyLooksValid({ spreadsheetId: 'abc', secret }), false); // id too short
  assert.equal(keyLooksValid({ spreadsheetId: 'a'.repeat(101), secret }), false);
  assert.equal(keyLooksValid({ spreadsheetId: id, secret: 'def' }), false);
  assert.equal(keyLooksValid({ spreadsheetId: id, secret: secret + 'x' }), false);
  assert.equal(keyLooksValid({ spreadsheetId: id, secret: secret.slice(0, 42) + '+' }), false);
});

test('read gate: 10 unknown-sheet reads per minute, trusted sheets always pass', () => {
  let t = 0;
  const gate = makeReadGate({ limit: 10, windowMs: 60_000, now: () => t });
  for (let i = 0; i < 10; i++) assert.equal(gate.allow(`s${i}`), true, `read ${i}`);
  assert.equal(gate.allow('s99'), false);
  gate.trust('good');
  assert.equal(gate.allow('good'), true);
  t = 59_999;
  assert.equal(gate.allow('s99'), false);
  t = 60_000;
  assert.equal(gate.allow('s99'), true);
});

test('read gate: refused calls do not use up the window', () => {
  let t = 0;
  const gate = makeReadGate({ limit: 2, windowMs: 1000, now: () => t });
  assert.equal(gate.allow('a'), true);
  t = 500;
  assert.equal(gate.allow('b'), true);
  assert.equal(gate.allow('c'), false);
  t = 1000; // the first read leaves the window
  assert.equal(gate.allow('c'), true);
  assert.equal(gate.allow('d'), false);
});

import { parseDeviceKeys, findDeviceKey, MAX_DEVICE_KEYS, type StoredKey } from '../src/lib/deviceKey.ts';

const allowed = ['me@example.com'];
const row = (id: string, secret: string): StoredKey => ({ id, name: `Device ${id}`, hash: hashSecret(secret), createdAt: '2026-10-31T10:00:00.000Z' });
const sheet = (keys: StoredKey[], ownerEmail = ' Me@Example.com ') => ({ deviceKeys: JSON.stringify(keys), ownerEmail });

test('up to 10 devices', () => {
  assert.equal(MAX_DEVICE_KEYS, 10);
});

test('parseDeviceKeys reads good rows', () => {
  const keys = [row('a', makeSecret()), row('b', makeSecret())];
  assert.deepEqual(parseDeviceKeys(JSON.stringify(keys)), keys);
});

test('parseDeviceKeys is empty for nothing or junk', () => {
  for (const raw of [undefined, '', 'not json', '{"id":"a"}', 'null', '5']) assert.deepEqual(parseDeviceKeys(raw), [], String(raw));
});

test('parseDeviceKeys drops bad rows and keeps the good ones', () => {
  const good = row('a', makeSecret());
  const { id: _id, ...noId } = good;
  const { name: _name, ...noName } = good;
  const { hash: _hash, ...noHash } = good;
  const raw = JSON.stringify([noId, noName, noHash, { ...good, id: 5 }, { ...good, name: '' }, null, 'x', 7, good]);
  assert.deepEqual(parseDeviceKeys(raw), [good]);
});

test('findDeviceKey: the right key among several', () => {
  const secrets = [makeSecret(), makeSecret(), makeSecret()];
  const keys = secrets.map((s, i) => row(String(i), s));
  for (let i = 0; i < 3; i++) assert.equal(findDeviceKey(sheet(keys), secrets[i], allowed)?.id, String(i));
});

test('findDeviceKey: a bad row does not hide a good one', () => {
  const secret = makeSecret();
  const raw = JSON.stringify([{ id: 'x' }, { ...row('b', makeSecret()), hash: 'zz' }, row('a', secret)]);
  assert.equal(findDeviceKey({ deviceKeys: raw, ownerEmail: 'me@example.com' }, secret, allowed)?.id, 'a');
});

test('findDeviceKey: wrong secret, empty list or junk is null', () => {
  const secret = makeSecret();
  const owner = { ownerEmail: 'me@example.com' };
  assert.equal(findDeviceKey(sheet([row('a', secret)]), makeSecret(), allowed), null);
  assert.equal(findDeviceKey(sheet([]), secret, allowed), null);
  assert.equal(findDeviceKey(owner, secret, allowed), null);
  assert.equal(findDeviceKey({ ...owner, deviceKeys: '' }, secret, allowed), null);
  assert.equal(findDeviceKey({ ...owner, deviceKeys: 'junk' }, secret, allowed), null);
});

test('findDeviceKey: owner missing or not allowed is null', () => {
  const secret = makeSecret();
  const keys = [row('a', secret)];
  assert.equal(findDeviceKey({ deviceKeys: JSON.stringify(keys) }, secret, allowed), null);
  assert.equal(findDeviceKey(sheet(keys, ''), secret, allowed), null);
  assert.equal(findDeviceKey(sheet(keys), secret, ['other@example.com']), null);
  assert.equal(findDeviceKey(sheet(keys), secret, []), null);
});

test('findDeviceKey: a turned-off key is null, the others still work', () => {
  const off = makeSecret();
  const on = makeSecret();
  const keys = [row('off', off), row('on', on)];
  assert.equal(findDeviceKey(sheet(keys), off, allowed)?.id, 'off');
  const left = keys.filter((k) => k.id !== 'off');
  assert.equal(findDeviceKey(sheet(left), off, allowed), null);
  assert.equal(findDeviceKey(sheet(left), on, allowed)?.id, 'on');
});
