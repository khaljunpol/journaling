import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess } from '../src/lib/accessRule.ts';

const allowed = ['alex@x.com'];

test('public paths pass for anyone', () => {
  for (const pathname of ['/api/auth/x', '/_next/x', '/favicon.ico', '/manifest.webmanifest', '/sw.js', '/icon']) {
    assert.equal(decideAccess({ pathname, email: null, allowed }), 'next', pathname);
    assert.equal(decideAccess({ pathname, email: 'no@x.com', allowed }), 'next', pathname);
  }
});

test('signed out', () => {
  assert.equal(decideAccess({ pathname: '/api/logs', email: null, allowed }), 'json-401');
  assert.equal(decideAccess({ pathname: '/login', email: null, allowed }), 'next');
  assert.equal(decideAccess({ pathname: '/', email: null, allowed }), 'to-login');
});

test('signed in but not allowed: login stays reachable (no loop)', () => {
  assert.equal(decideAccess({ pathname: '/api/logs', email: 'no@x.com', allowed }), 'json-403');
  assert.equal(decideAccess({ pathname: '/login', email: 'no@x.com', allowed }), 'next');
  assert.equal(decideAccess({ pathname: '/', email: 'no@x.com', allowed }), 'to-denied');
});

test('empty allowlist denies a signed-in user', () => {
  assert.equal(decideAccess({ pathname: '/', email: 'alex@x.com', allowed: [] }), 'to-denied');
});

test('allowed user', () => {
  assert.equal(decideAccess({ pathname: '/login', email: ' ALEX@X.com ', allowed }), 'to-home');
  assert.equal(decideAccess({ pathname: '/journal', email: 'alex@x.com', allowed }), 'next');
});

test('only the exact reminder run path is public', () => {
  assert.equal(decideAccess({ pathname: '/api/reminder/run', email: null, allowed }), 'next');
  assert.equal(decideAccess({ pathname: '/api/reminder/runx', email: null, allowed }), 'json-401');
  assert.equal(decideAccess({ pathname: '/api/reminders', email: null, allowed }), 'json-401');
  assert.equal(decideAccess({ pathname: '/api/push/subscribe', email: null, allowed }), 'json-401');
});

test('only the exact device path is public; the keys route needs a session', () => {
  assert.equal(decideAccess({ pathname: '/api/device', email: null, allowed }), 'next');
  assert.equal(decideAccess({ pathname: '/api/device/keys', email: null, allowed }), 'json-401');
  assert.equal(decideAccess({ pathname: '/api/devicex', email: null, allowed }), 'json-401');
  assert.equal(decideAccess({ pathname: '/api/device/', email: null, allowed }), 'json-401');
});
