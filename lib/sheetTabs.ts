// Creates the core tabs a sheet needs. Never overwrites: headers are written only to
// tabs this run just created. Import-free (except relative files) so node --test can load it.
import { HEADERS, TABS, type TabKey } from './sheetLayout.ts';
import { findAccountSets } from './tabRename.ts';

export interface TabsClient {
  listTitles(spreadsheetId: string): Promise<string[]>;
  addTabs(spreadsheetId: string, titles: string[]): Promise<void>;
  /** Writes every header row in one call. */
  writeHeaders(spreadsheetId: string, entries: Array<{ title: string; header: string[] }>): Promise<void>;
}

/**
 * Adds every missing core tab in one call. Returns the titles it created.
 * A plain tab is not created while an old `<Base>_<name>` tab exists, so the
 * one-time rename (scripts/rename-tabs.ts) is never blocked by an empty plain tab.
 */
export async function ensureCoreTabs(client: TabsClient, spreadsheetId: string): Promise<string[]> {
  const titles = await client.listTitles(spreadsheetId);
  const existing = new Set(titles);
  const oldBases = new Set(
    findAccountSets(titles).flatMap((set) => set.tabs.map((tab) => tab.slice(0, tab.indexOf('_')))),
  );
  const missing = (Object.keys(TABS) as TabKey[]).filter((key) => !existing.has(TABS[key]));
  const blocked = missing.filter((key) => oldBases.has(TABS[key]));
  if (blocked.length > 0) {
    console.warn('[sheets] old <Base>_<name> tabs found: run scripts/rename-tabs.ts first');
  }
  const toCreate = missing.filter((key) => !oldBases.has(TABS[key]));
  if (toCreate.length === 0) return [];
  const created = toCreate.map((key) => TABS[key]);
  await client.addTabs(spreadsheetId, created);
  await client.writeHeaders(spreadsheetId, toCreate.map((key) => ({ title: TABS[key], header: HEADERS[key] })));
  return created;
}

// One run per spreadsheet id per server instance. A failed run (e.g. 429) is forgotten,
// so the next request tries again.
const runs = new Map<string, Promise<void>>();

export function ensureCoreTabsOnce(client: TabsClient, spreadsheetId: string): Promise<void> {
  const known = runs.get(spreadsheetId);
  if (known) return known;
  const run = ensureCoreTabs(client, spreadsheetId).then(() => undefined);
  runs.set(spreadsheetId, run);
  run.catch(() => { runs.delete(spreadsheetId); });
  return run;
}
