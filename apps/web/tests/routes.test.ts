import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LEGACY_REDIRECTS, NAV, shouldOpenToday } from '../src/lib/routes.ts';

describe('legacy redirects', () => {
  const map = new Map(LEGACY_REDIRECTS.map((r) => [r.source, r.destination]));

  it('maps every old page as in the design', () => {
    assert.equal(map.get('/journal'), '/quick');
    assert.equal(map.get('/mood'), '/trends?tab=mood');
    assert.equal(map.get('/time'), '/trends?tab=time');
    assert.equal(map.get('/sidequests'), '/progress');
    assert.equal(map.get('/activities'), '/settings#activities');
    assert.equal(map.get('/time-categories'), '/settings#time');
    assert.equal(map.get('/climbing-log'), '/climbing?tab=log');
    assert.equal(map.get('/climbing-goals'), '/climbing?tab=log');
  });

  it('never redirects a page that still exists', () => {
    for (const item of NAV) assert.equal(map.has(item.href), false, item.href);
  });

  it('has no duplicate sources', () => {
    assert.equal(map.size, LEGACY_REDIRECTS.length);
  });
});

describe('nav', () => {
  it('lists the six places in order with their keys', () => {
    assert.deepEqual(NAV.map((n) => n.id), ['today', 'overview', 'trends', 'climbing', 'progress', 'settings']);
    assert.deepEqual(NAV.map((n) => n.key), ['q', 'o', 'r', 'c', 'p', ',']);
  });

  it('points Today at /quick and Overview at /', () => {
    assert.equal(NAV[0].href, '/quick');
    assert.equal(NAV[1].href, '/');
  });
});

describe('shouldOpenToday', () => {
  it('opens Today on a phone-width screen', () => {
    assert.equal(shouldOpenToday(390, ''), true);
    assert.equal(shouldOpenToday(639, ''), true);
  });
  it('stays when ?stay=1 is set', () => {
    assert.equal(shouldOpenToday(390, '?stay=1'), false);
    assert.equal(shouldOpenToday(390, 'stay=1'), false);
  });
  it('stays on tablet and desktop', () => {
    assert.equal(shouldOpenToday(640, ''), false);
    assert.equal(shouldOpenToday(768, ''), false);
  });
});
