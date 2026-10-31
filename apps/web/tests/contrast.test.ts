import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inkOn } from '../src/lib/contrast.ts';

test('dark text on light colours, light text on dark ones', () => {
  assert.equal(inkOn('#ffff66'), 'dark'); // yellow
  assert.equal(inkOn('#00ff00'), 'dark'); // bright green
  assert.equal(inkOn('#f0f0f0'), 'dark');
  assert.equal(inkOn('#0000ff'), 'light'); // blue
  assert.equal(inkOn('#4a3410'), 'light'); // dark brown
  assert.equal(inkOn('#444444'), 'light');
  assert.equal(inkOn('#9900cc'), 'light'); // purple
});

test('short hex and junk', () => {
  assert.equal(inkOn('#fff'), 'dark');
  assert.equal(inkOn('#000'), 'light');
  assert.equal(inkOn('nope'), 'dark');
});
