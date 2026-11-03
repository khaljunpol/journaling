import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LEGACY_REDIRECTS, NAV, PHONE_TABS, navIdForPath } from '../src/lib/routes.ts';

describe('legacy redirects', () => {
  const map = new Map(LEGACY_REDIRECTS.map((r) => [r.source, r.destination]));

  it('maps every old page to its new home', () => {
    assert.equal(map.get('/journal'), '/quick');
    assert.equal(map.get('/mood'), '/insights');
    assert.equal(map.get('/time'), '/insights?section=time');
    assert.equal(map.get('/trends'), '/insights');
    assert.equal(map.get('/progress'), '/you');
    assert.equal(map.get('/sidequests'), '/you');
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
  it('lists the five pages and Settings, in order, with their keys', () => {
    assert.deepEqual(NAV.map((n) => n.id), ['today', 'home', 'insights', 'climbing', 'you', 'settings']);
    assert.deepEqual(NAV.map((n) => n.href), ['/quick', '/', '/insights', '/climbing', '/you', '/settings']);
    assert.deepEqual(NAV.map((n) => n.key), ['q', 'o', 'i', 'c', 'y', ',']);
  });

  it('phone tabs are Today, Home, Insights, You', () => {
    assert.deepEqual(PHONE_TABS, ['today', 'home', 'insights', 'you']);
  });

  it('the World belongs to You', () => {
    assert.equal(navIdForPath('/world'), 'you');
    assert.equal(navIdForPath('/'), 'home');
    assert.equal(navIdForPath('/insights'), 'insights');
  });
});
