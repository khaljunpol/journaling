import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/api/dashboard/route.ts', 'utf8');

describe('dashboard route prefetch', () => {
  it('reads all tabs in one tabCache.read before the data calls', () => {
    const reads = src.match(/tabCache\.read\(/g) ?? [];
    assert.equal(reads.length, 1);
    const at = src.indexOf('tabCache.read(');
    assert.ok(at < src.indexOf('listActivities(sheetAuth)'));
    for (const tab of ['activities', 'logs', 'weights', 'highlights', 'moods', 'timeCategories', 'hours', 'climbs', 'climbGoals', 'sidequests']) {
      assert.ok(src.slice(at, src.indexOf(']', at)).includes(`'${tab}'`), tab);
    }
  });
});
