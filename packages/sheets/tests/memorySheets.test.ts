import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySheets } from '../src/memorySheets.ts';

const seedOf = (id: string) =>
  id.startsWith('demo-')
    ? { Habits: [['id', 'name'], ['a', 'Gym'], ['b', 'Coffee', 'x', '', '']], Empty: [['h1', 'h2']] }
    : null;

const get = async (s: ReturnType<typeof createMemorySheets>, id: string, range: string) =>
  (await s.spreadsheets.values.get({ spreadsheetId: id, range })).data.values;

test('get returns rows below the header, trailing empty cells trimmed; empty range gives values undefined', async () => {
  const s = createMemorySheets(seedOf);
  assert.deepEqual(await get(s, 'demo-1', "'Habits'!A2:Y"), [['a', 'Gym'], ['b', 'Coffee', 'x']]);
  assert.equal(await get(s, 'demo-1', "'Empty'!A2:Y"), undefined);
  assert.deepEqual(await get(s, 'demo-1', "'Habits'!A1"), [['id']]);
});

test('append adds after the last row; update writes a single cell (E5) and a row range (B5:Y5)', async () => {
  const s = createMemorySheets(seedOf);
  await s.spreadsheets.values.append({ spreadsheetId: 'demo-1', range: "'Habits'!A1:D", valueInputOption: 'RAW', requestBody: { values: [['c', 'Walk']] } });
  assert.deepEqual(await get(s, 'demo-1', "'Habits'!A4:B"), [['c', 'Walk']]);
  await s.spreadsheets.values.append({ spreadsheetId: 'demo-1', range: "'Empty'!A1:B", requestBody: { values: [['p', 'q']] } });
  assert.deepEqual(await get(s, 'demo-1', "'Empty'!A2:B"), [['p', 'q']]);
  await s.spreadsheets.values.update({ spreadsheetId: 'demo-1', range: "'Habits'!E5", requestBody: { values: [['z']] } });
  assert.deepEqual(await get(s, 'demo-1', "'Habits'!A5:E5"), [['', '', '', '', 'z']]);
  const row = Array.from({ length: 24 }, (_, i) => String(i));
  await s.spreadsheets.values.update({ spreadsheetId: 'demo-1', range: "'Habits'!B5:Y5", requestBody: { values: [row] } });
  assert.deepEqual((await get(s, 'demo-1', "'Habits'!A5:Y5"))![0].slice(0, 3), ['', '0', '1']);
  assert.equal((await get(s, 'demo-1', "'Habits'!A5:Y5"))![0].length, 25);
});

test('batchUpdate deleteDimension removes the row; clear blanks it', async () => {
  const s = createMemorySheets(seedOf);
  const meta = await s.spreadsheets.get({ spreadsheetId: 'demo-1' });
  const sheetId = meta.data.sheets!.find((t) => t.properties!.title === 'Habits')!.properties!.sheetId;
  await s.spreadsheets.batchUpdate({ spreadsheetId: 'demo-1', requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } }] } });
  assert.deepEqual(await get(s, 'demo-1', "'Habits'!A2:Y"), [['b', 'Coffee', 'x']]);
  await s.spreadsheets.values.clear({ spreadsheetId: 'demo-1', range: "'Habits'!A2:C2" });
  assert.equal(await get(s, 'demo-1', "'Habits'!A2:Y"), undefined);
  // Last row and header-only tab: no crash.
  await s.spreadsheets.batchUpdate({ spreadsheetId: 'demo-1', requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } }] } });
  await s.spreadsheets.batchUpdate({ spreadsheetId: 'demo-1', requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: 5, endIndex: 6 } } }] } });
  assert.equal(await get(s, 'demo-1', "'Habits'!A2:Y"), undefined);
});

test('addSheet adds a tab; get lists titles with sheetIds', async () => {
  const s = createMemorySheets(seedOf);
  await s.spreadsheets.batchUpdate({ spreadsheetId: 'demo-1', requestBody: { requests: [{ addSheet: { properties: { title: "It's" } } }] } });
  const tabs = (await s.spreadsheets.get({ spreadsheetId: 'demo-1' })).data.sheets!.map((t) => t.properties!);
  assert.deepEqual(tabs.map((t) => t.title), ['Habits', 'Empty', "It's"]);
  assert.equal(new Set(tabs.map((t) => t.sheetId)).size, 3);
  await s.spreadsheets.values.batchUpdate({ spreadsheetId: 'demo-1', requestBody: { data: [{ range: "'It''s'!A1", values: [['k', 'v']] }] } });
  const r = await s.spreadsheets.values.batchGet({ spreadsheetId: 'demo-1', ranges: ["'It''s'!A1:B", "'Empty'!A2:B"] });
  assert.deepEqual(r.data.valueRanges!.map((v) => v.values), [[['k', 'v']], undefined]);
});

test('two sheet ids never share rows', async () => {
  const s = createMemorySheets(seedOf);
  await s.spreadsheets.values.append({ spreadsheetId: 'demo-1', range: "'Habits'!A1:B", requestBody: { values: [['n', 'New']] } });
  assert.equal((await get(s, 'demo-1', "'Habits'!A2:B"))!.length, 3);
  assert.equal((await get(s, 'demo-2', "'Habits'!A2:B"))!.length, 2);
});

test('an idle sandbox is reseeded after 2 hours (fake now); the 201st drops the oldest', async () => {
  let t = 1000;
  const s = createMemorySheets(seedOf, { now: () => t });
  await s.spreadsheets.values.append({ spreadsheetId: 'demo-1', range: "'Habits'!A1:B", requestBody: { values: [['n', 'New']] } });
  t += 7_199_000;
  assert.equal((await get(s, 'demo-1', "'Habits'!A2:B"))!.length, 3);
  t += 7_200_001;
  assert.equal((await get(s, 'demo-1', "'Habits'!A2:B"))!.length, 2);

  const m = createMemorySheets(seedOf, { now: () => t });
  await m.spreadsheets.values.append({ spreadsheetId: 'demo-0', range: "'Habits'!A1:B", requestBody: { values: [['n', 'New']] } });
  for (let i = 1; i <= 200; i++) await get(m, `demo-${i}`, "'Habits'!A2:B");
  assert.equal((await get(m, 'demo-0', "'Habits'!A2:B"))!.length, 2);
});

test('an unknown non-demo id throws code 404', async () => {
  const s = createMemorySheets(seedOf);
  await assert.rejects(get(s, 'real-sheet', "'Habits'!A2:B"), (e: Error & { code?: number }) => e.code === 404);
  await assert.rejects(s.spreadsheets.get({ spreadsheetId: 'real-sheet' }), (e: Error & { code?: number }) => e.code === 404);
});
