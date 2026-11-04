import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appDay, appTimeZone } from '../src/timeZone.ts';

const KEY = 'NEXT_PUBLIC_APP_TIME_ZONE';

function withZone(zone: string | undefined, fn: () => void) {
  const before = process.env[KEY];
  if (zone === undefined) delete process.env[KEY];
  else process.env[KEY] = zone;
  try {
    fn();
  } finally {
    if (before === undefined) delete process.env[KEY];
    else process.env[KEY] = before;
  }
}

test('no setting means UTC', () => {
  withZone(undefined, () => {
    assert.equal(appTimeZone(), 'UTC');
    assert.equal(appDay(new Date('2026-01-01T23:30:00Z')), '2026-01-01');
  });
});

test('a set zone moves the day line', () => {
  withZone('Asia/Tokyo', () => {
    assert.equal(appTimeZone(), 'Asia/Tokyo');
    assert.equal(appDay(new Date('2026-01-01T14:59:00Z')), '2026-01-01');
    assert.equal(appDay(new Date('2026-01-01T15:01:00Z')), '2026-01-02');
  });
});

test('an unknown zone falls back to UTC', () => {
  withZone('Not/AZone', () => {
    assert.equal(appTimeZone(), 'UTC');
  });
});
