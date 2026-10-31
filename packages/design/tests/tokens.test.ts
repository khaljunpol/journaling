import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dark, light, shared, tokensCss } from '../src/tokens.ts';

test('tokens.css matches tokens.ts', () => {
  const file = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(file, tokensCss(), 'run: npm run css -w @journaling/design');
});

test('both themes define the same tokens', () => {
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
});

test('dark is the default and light only overrides on data-theme', () => {
  const css = tokensCss();
  assert.match(css, /:root \{\n {2}color-scheme: dark;/);
  assert.match(css, /:root\[data-theme="light"\] \{\n {2}color-scheme: light;/);
  assert.ok(css.includes(`--ease-out: ${shared['ease-out']};`));
});
