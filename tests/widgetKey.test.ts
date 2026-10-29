import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSecret, hashSecret, secretMatches, parseKey, encodeCode, decodeCode } from '../src/lib/widgetKey.ts';

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

import { keyLooksValid, makeReadGate } from '../src/lib/widgetKey.ts';

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

test('decideWidgetKey: right key passes; off, wrong, missing or disallowed owner fail', async () => {
  const { decideWidgetKey } = await import('../src/lib/widgetKey.ts');
  const secret = makeSecret();
  const ok = { widgetKeyHash: hashSecret(secret), ownerEmail: ' Me@Example.com ' };
  const allowed = ['me@example.com'];
  assert.equal(decideWidgetKey(ok, secret, allowed), true);
  assert.equal(decideWidgetKey(ok, makeSecret(), allowed), false);
  assert.equal(decideWidgetKey({ ...ok, widgetKeyHash: '' }, secret, allowed), false);
  assert.equal(decideWidgetKey({ widgetKeyHash: ok.widgetKeyHash }, secret, allowed), false);
  assert.equal(decideWidgetKey(ok, secret, ['other@example.com']), false);
  assert.equal(decideWidgetKey(ok, secret, []), false);
});
