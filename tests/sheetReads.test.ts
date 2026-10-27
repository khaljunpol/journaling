// Static check: reads go through the shared tab cache, writes stay fresh and invalidate.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function exportedFunctions(file: string): Map<string, string> {
  const src = readFileSync(file, 'utf8');
  const out = new Map<string, string>();
  const parts = src.split(/^export async function /m).slice(1);
  for (const part of parts) {
    const name = part.match(/^(\w+)/)?.[1];
    if (!name) continue;
    const end = part.search(/^(export |async function |function |const |type )/m);
    out.set(name, end === -1 ? part : part.slice(0, end));
  }
  return out;
}

const fns = new Map([
  ...exportedFunctions('src/lib/googleSheets.ts'),
  ...exportedFunctions('src/lib/sidequests.ts'),
]);

const READS = [
  'listActivities', 'getLogsForDate', 'getLogsBetween', 'getHighlight', 'getHighlightsBetween',
  'getWeight', 'getWeightsBetween', 'getMood', 'getMoodsBetween', 'getConsistencyMetrics',
  'listClimbLogs', 'listClimbGoals', 'listHourLogs', 'listTimeCategories',
  'listSidequests', 'getSidequest', 'listSidequestLogs', 'getSettings',
];

const WRITE_NAME = /^(create|update|delete|append|set|upsert|add)/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('sheet reads use the tab cache', () => {
  it('finds the write functions', () => {
    const writes = [...fns.keys()].filter((n) => WRITE_NAME.test(n));
    assert.ok(writes.length >= 15, `only found ${writes.length}`);
  });

  for (const name of READS) {
    it(`${name} reads through tabCache`, () => {
      const body = fns.get(name);
      assert.ok(body, `${name} not found`);
      assert.match(body, /tabCache\.read/);
      assert.doesNotMatch(body, /values\.get\(/);
    });
  }

  it('setSetting and upsertLog are writes that invalidate in finally', () => {
    for (const name of ['setSetting', 'upsertLog']) {
      const body = fns.get(name) ?? '';
      assert.ok(body, `${name} not found`);
      assert.match(body, /finally\s*\{[^}]*tabCache\.invalidate\(/);
      assert.match(body, /values\.get\(/);
      assert.doesNotMatch(body, /tabCache\.read/);
    }
  });

  it('listTimeCategories invalidates after seeding', () => {
    assert.match(fns.get('listTimeCategories') ?? '', /tabCache\.invalidate\(/);
  });

  it('every write invalidates in finally', () => {
    const bad = [...fns.entries()]
      .filter(([n]) => WRITE_NAME.test(n))
      .filter(([, body]) => !/finally\s*\{[^}]*tabCache\.invalidate\(/.test(body))
      .map(([n]) => n);
    assert.deepEqual(bad, []);
  });

  it('writes that look up a row read it fresh, never from the cache', () => {
    const bad = [...fns.entries()]
      .filter(([n, body]) => WRITE_NAME.test(n) && /rowIndex/.test(body))
      .filter(([, body]) => !/values\.get\(/.test(body) || /tabCache\.read/.test(body))
      .map(([n]) => n);
    assert.deepEqual(bad, []);
  });

  it('no API route imports apiCache', () => {
    const bad = sourceFiles('src/app/api').filter((f) => /apiCache/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(bad, []);
  });
});
