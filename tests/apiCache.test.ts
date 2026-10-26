import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cacheKey, createApiCache } from '../lib/apiCache.ts';

describe('cacheKey', () => {
  it('differs for different spreadsheet ids', () => {
    assert.notEqual(
      cacheKey('A', 'hours', 'default', '2026-10-01'),
      cacheKey('B', 'hours', 'default', '2026-10-01'),
    );
  });

  it('starts with the spreadsheet id', () => {
    assert.ok(cacheKey('A', 'x').startsWith('A|'));
  });

  it('turns null and undefined into empty parts', () => {
    assert.equal(cacheKey('A', 'x', null, undefined, 3), 'A|x|||3');
  });

  it('does not share entries between spreadsheets', () => {
    const cache = createApiCache<number[]>();
    cache.set(cacheKey('A', 'goals'), [1]);
    assert.equal(cache.get(cacheKey('B', 'goals')), undefined);
    assert.deepEqual(cache.get(cacheKey('A', 'goals')), [1]);
  });
});
