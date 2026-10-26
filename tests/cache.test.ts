import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLocalCache } from '../lib/cache.ts';

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

test('clearLocalCache keeps only theme', () => {
  const s = fakeStorage({ theme: 'dark', dashboard: '{}', 'mood:2026-10-01': '{}' });
  (globalThis as any).localStorage = s;
  try {
    clearLocalCache();
    assert.deepEqual(Array.from(s.data.keys()), ['theme']);
  } finally {
    delete (globalThis as any).localStorage;
  }
});

test('clearLocalCache does not throw without localStorage', () => {
  delete (globalThis as any).localStorage;
  assert.doesNotThrow(() => clearLocalCache());
});
