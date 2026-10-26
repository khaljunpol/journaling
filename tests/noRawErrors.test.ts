import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = sourceFiles('app/api');

describe('API files never send raw error text', () => {
  it('finds the api files', () => {
    assert.ok(files.length > 10);
  });

  for (const pattern of [
    /getErrorMessage\(/,
    /String\((error|err|e)\)/,
    /\b(error|err|e)\.message/,
    /\b(error|err|e)\.stack/,
  ]) {
    it(`no ${pattern}`, () => {
      const bad = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
      assert.deepEqual(bad, []);
    });
  }
});
