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

export function createTabCache(
  reader: RangeReader,
  opts: { ttlMs?: number; now?: () => number } = {},
) {
  const ttlMs = opts.ttlMs ?? 30_000;
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Inflight>();
  const gens = new Map<string, number>();

  const keyOf = (id: string, tab: TabKey) => `${id}\u0000${tab}`;
  const genOf = (key: string) => gens.get(key) ?? 0;

  async function read(spreadsheetId: string, tabs: TabKey[]): Promise<Record<TabKey, Rows>> {
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
        const record: Inflight = { promise, gen };
        inflight.set(key, record);
        const clean = () => { if (inflight.get(key) === record) inflight.delete(key); };
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
    clear(): void {
      for (const key of new Set([...entries.keys(), ...inflight.keys()])) gens.set(key, genOf(key) + 1);
      entries.clear();
      inflight.clear();
    },
  };
}
