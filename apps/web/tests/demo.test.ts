import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DOMAIN, demoSheetId, isDemo } from '../src/lib/demo.ts';

test('demoSheetId: a demo email gives its sheet id', () => {
  assert.equal(demoSheetId('demo-abc@demo.invalid'), 'demo-abc');
  assert.equal(demoSheetId(' Demo-ABC@Demo.Invalid '), 'demo-abc');
});

test('demoSheetId: a real email gives null', () => {
  assert.equal(demoSheetId('x@gmail.com'), null);
  assert.equal(demoSheetId('abc@demo.invalid'), null);
  assert.equal(demoSheetId('demo-abc@demo.invalid.example.com'), null);
  assert.equal(demoSheetId('@demo.invalid'), null);
});

test('DEMO_DOMAIN', () => {
  assert.equal(DEMO_DOMAIN, 'demo.invalid');
});

test('isDemo reads DEMO_MODE at call time', () => {
  const before = process.env.DEMO_MODE;
  try {
    process.env.DEMO_MODE = '1';
    assert.equal(isDemo(), true);
    process.env.DEMO_MODE = 'true';
    assert.equal(isDemo(), false);
    delete process.env.DEMO_MODE;
    assert.equal(isDemo(), false);
  } finally {
    if (before === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = before;
  }
});
