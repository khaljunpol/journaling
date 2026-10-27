import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appDateISO, shouldRemind, checkCronAuth, isPushEndpoint } from '../src/lib/reminder.ts';

test('appDateISO uses the UTC calendar day', () => {
  assert.equal(appDateISO(new Date('2026-10-27T22:30:00Z')), '2026-10-28');
  assert.equal(appDateISO(new Date('2026-10-27T12:00:00Z')), '2026-10-27');
});

test('shouldRemind: only when on, subscribed and something is empty', () => {
  const open = { filled: 3, total: 6 };
  assert.equal(shouldRemind({ enabled: true, hasSubscription: true, status: open }), true);
  assert.equal(shouldRemind({ enabled: false, hasSubscription: true, status: open }), false);
  assert.equal(shouldRemind({ enabled: true, hasSubscription: false, status: open }), false);
  assert.equal(shouldRemind({ enabled: true, hasSubscription: true, status: { filled: 6, total: 6 } }), false);
});

test('checkCronAuth', () => {
  assert.equal(checkCronAuth('Bearer s3cret', 's3cret'), true);
  assert.equal(checkCronAuth('Bearer wrong!', 's3cret'), false);
  assert.equal(checkCronAuth('Bearer s3cre', 's3cret'), false);
  assert.equal(checkCronAuth('s3cret', 's3cret'), false);
  assert.equal(checkCronAuth(null, 's3cret'), false);
  assert.equal(checkCronAuth('Bearer s3cret', undefined), false);
  assert.equal(checkCronAuth('Bearer ', ''), false);
  assert.equal(checkCronAuth('Bearer ', undefined), false);
});

test('isPushEndpoint allows only known push services over https', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/xyz',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://abc.push.services.mozilla.com/x',
    'https://db5.notify.windows.com/?token=1',
  ]) assert.equal(isPushEndpoint(ok), true, ok);
  for (const bad of [
    'https://fcm.googleapis.com.evil.com/x',
    'https://evilfcm.googleapis.com/x',
    'https://push.apple.com.evil.com/x',
    'http://fcm.googleapis.com/x',
    'https://example.com/x',
    'not a url',
    '',
  ]) assert.equal(isPushEndpoint(bad), false, bad);
});
