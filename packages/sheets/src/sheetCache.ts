// Short-lived per-sheet tab cache. Only import is the pure layout module, so tests can load it.
// Cache keys always include the spreadsheet id. Returned rows are deeply frozen (read-only).

import { dataRange, type TabKey } from './sheetLayout.ts';

export interface RangeReader {
  /** One rows array per range, same order. */
  batchGet(spreadsheetId: string, ranges: string[]): Promise<string[][][]>;
}

type Rows = string[][];
type Entry = { rows: Rows; expires: number };
type Inflight = { promise: Promise<Rows>; gen: number };

function freezeRows(rows: Rows): Rows {
  for (const row of rows) Object.freeze(row);
  return Object.freeze(rows) as Rows;
}

/** When the cache holds more entries than this, a read sweeps out dead keys. */
export const SWEEP_THRESHOLD = 500;

export function createTabCache(
  reader: RangeReader,
  opts: { ttlMs?: number; now?: () => number } = {},
) {
  const ttlMs = opts.ttlMs ?? 30_000;
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Inflight>();
  const gens = new Map<string, number>();
  // Fetches still running per key, including ones dropped by invalidate.
  const live = new Map<string, number>();

  const keyOf = (id: string, tab: TabKey) => `${id}\u0000${tab}`;
  const genOf = (key: string) => gens.get(key) ?? 0;

  // Drops expired entries, then generation counters that no entry or running fetch needs.
  function sweep(): void {
    const t = now();
    for (const [key, e] of entries) if (e.expires <= t) entries.delete(key);
    for (const key of gens.keys()) if (!entries.has(key) && !live.has(key)) gens.delete(key);
  }

  async function read(spreadsheetId: string, tabs: TabKey[]): Promise<Record<TabKey, Rows>> {
    if (entries.size > SWEEP_THRESHOLD) sweep();
    const unique = [...new Set(tabs)];
    const pending = new Map<TabKey, Promise<Rows>>();
    const missing: TabKey[] = [];

    for (const tab of unique) {
      const key = keyOf(spreadsheetId, tab);
      const hit = entries.get(key);
      if (hit && hit.expires > now()) {
        pending.set(tab, Promise.resolve(hit.rows));
        continue;
      }
      if (hit) entries.delete(key);
      const flying = inflight.get(key);
      if (flying) pending.set(tab, flying.promise);
      else missing.push(tab);
    }

    if (missing.length > 0) {
      const gensAtStart = missing.map((tab) => genOf(keyOf(spreadsheetId, tab)));
      const batch = reader.batchGet(spreadsheetId, missing.map(dataRange));
      missing.forEach((tab, i) => {
        const key = keyOf(spreadsheetId, tab);
        const gen = gensAtStart[i];
        const promise = batch.then((all) => {
          const rows = freezeRows(all[i] ?? []);
          if (genOf(key) === gen) entries.set(key, { rows, expires: now() + ttlMs });
          return rows;
        });
        live.set(key, (live.get(key) ?? 0) + 1);
        const record: Inflight = { promise, gen };
        inflight.set(key, record);
        const clean = () => {
          if (inflight.get(key) === record) inflight.delete(key);
          const left = (live.get(key) ?? 1) - 1;
          if (left > 0) live.set(key, left); else live.delete(key);
        };
        promise.then(clean, clean);
        pending.set(tab, promise);
      });
    }

    const out = {} as Record<TabKey, Rows>;
    await Promise.all(unique.map(async (tab) => { out[tab] = await pending.get(tab)!; }));
    return out;
  }

  return {
    read,
    async readOne(spreadsheetId: string, tab: TabKey): Promise<Rows> {
      return (await read(spreadsheetId, [tab]))[tab];
    },
    invalidate(spreadsheetId: string, tab: TabKey): void {
      const key = keyOf(spreadsheetId, tab);
      gens.set(key, genOf(key) + 1);
      entries.delete(key);
      inflight.delete(key);
    },
    /** Map sizes, for tests. */
    sizes: () => ({ entries: entries.size, gens: gens.size }),
    clear(): void {
      for (const key of new Set([...entries.keys(), ...inflight.keys()])) gens.set(key, genOf(key) + 1);
      entries.clear();
      inflight.clear();
    },
  };
}
