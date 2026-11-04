// The one shared in-memory Sheets client for demo mode. Kept on globalThis so every request
// (and hot reload) uses the same sandboxes. Only ids starting "demo-" get a seeded sandbox.
// Relative .ts imports only, so tests can load it.
import { localTodayISO } from '../../core/src/date.ts';
import { demoSeed } from './demoSeed.ts';
import { createMemorySheets } from './memorySheets.ts';

const globalKey = '__sheetsDemoClient';

export function demoSheets(): ReturnType<typeof createMemorySheets> {
  const g = globalThis as typeof globalThis & { [globalKey]?: ReturnType<typeof createMemorySheets> };
  if (!g[globalKey]) {
    g[globalKey] = createMemorySheets((id) => (id.startsWith('demo-') ? demoSeed(localTodayISO()) : null));
  }
  return g[globalKey];
}
