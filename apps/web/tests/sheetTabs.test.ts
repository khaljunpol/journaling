import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ensureCoreTabs, ensureCoreTabsOnce, type TabsClient } from '../src/lib/sheetTabs.ts';
import { HEADERS, TABS } from '../src/lib/sheetLayout.ts';

type HeaderEntry = { title: string; header: string[] };

function fakeClient(existing: string[], opts: { failList?: unknown } = {}) {
  const calls = { listTitles: 0, addTabs: [] as string[][], writeHeaders: [] as HeaderEntry[][] };
  const client: TabsClient = {
    async listTitles() {
      calls.listTitles += 1;
      if (opts.failList) throw opts.failList;
      return [...existing];
    },
    async addTabs(_id, titles) { calls.addTabs.push(titles); },
    async writeHeaders(_id, entries) { calls.writeHeaders.push(entries); },
  };
  return { client, calls };
}

function quietWarn<T>(fn: () => Promise<T>): Promise<{ result: T; warnings: unknown[][] }> {
  const original = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  return fn().then(
    (result) => { console.warn = original; return { result, warnings }; },
    (err) => { console.warn = original; throw err; },
  );
}

describe('ensureCoreTabs', () => {
  it('adds all missing tabs in one call and writes all new headers in one call', async () => {
    const { client, calls } = fakeClient(['Logs', 'Moods']);
    const created = await ensureCoreTabs(client, 'id1');
    assert.equal(calls.addTabs.length, 1);
    assert.equal(calls.addTabs[0].length, 10);
    assert.equal(created.length, 10);
    assert.ok(!created.includes('Logs') && !created.includes('Moods'));
    assert.equal(calls.writeHeaders.length, 1);
    const entries = calls.writeHeaders[0];
    assert.equal(entries.length, 10);
    const titles = entries.map((e) => e.title);
    assert.ok(!titles.includes('Logs') && !titles.includes('Moods'));
    assert.deepEqual(entries.find((e) => e.title === TABS.activities)?.header, HEADERS.activities);
    assert.deepEqual(entries.find((e) => e.title === 'Settings')?.header, ['key', 'value']);
    assert.ok(created.includes('Settings'));
  });

  it('does nothing when every tab exists', async () => {
    const { client, calls } = fakeClient(Object.values(TABS));
    const created = await ensureCoreTabs(client, 'id1');
    assert.deepEqual(created, []);
    assert.equal(calls.addTabs.length, 0);
    assert.equal(calls.writeHeaders.length, 0);
  });

  it('never creates a plain tab while an old <Base>_<name> tab exists, and warns once', async () => {
    const { client, calls } = fakeClient(['Logs_Alex', 'Moods']);
    const { result: created, warnings } = await quietWarn(() => ensureCoreTabs(client, 'id1'));
    assert.equal(calls.addTabs.length, 1);
    assert.ok(!calls.addTabs[0].includes('Logs'));
    assert.ok(calls.addTabs[0].includes('Activities'));
    assert.ok(!created.includes('Logs'));
    assert.ok(!calls.writeHeaders[0].some((e) => e.title === 'Logs'));
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /run scripts\/rename-tabs\.ts first/);
  });

  it('does not warn when there are no old tabs', async () => {
    const { client } = fakeClient(['Moods']);
    const { warnings } = await quietWarn(() => ensureCoreTabs(client, 'id1'));
    assert.equal(warnings.length, 0);
  });
});

describe('ensureCoreTabsOnce', () => {
  it('rejects on 429 and does not remember the failed run', async () => {
    const { client, calls } = fakeClient([], { failList: { code: 429 } });
    await assert.rejects(ensureCoreTabsOnce(client, 'id-429'));
    await assert.rejects(ensureCoreTabsOnce(client, 'id-429'));
    assert.equal(calls.listTitles, 2);
  });

  it('runs only once per spreadsheet id after a success', async () => {
    const { client, calls } = fakeClient(Object.values(TABS));
    await ensureCoreTabsOnce(client, 'id-once');
    await ensureCoreTabsOnce(client, 'id-once');
    assert.equal(calls.listTitles, 1);
  });
});
