import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoSheets } from '../src/demoSheets.ts';
import { HEADERS } from '../src/sheetLayout.ts';

test('demoSheets returns the same client twice', () => {
  assert.equal(demoSheets(), demoSheets());
});

test('a demo- id is seeded with the Activities header and rows', async () => {
  const res = await demoSheets().spreadsheets.values.get({ spreadsheetId: 'demo-abc', range: "'Activities'!A1:D" });
  const values = res.data.values ?? [];
  assert.deepEqual(values[0], [...HEADERS.activities]);
  assert.ok(values.length > 1);
});

test('a non-demo id throws code 404', async () => {
  await assert.rejects(
    demoSheets().spreadsheets.values.get({ spreadsheetId: 'real-sheet', range: "'Activities'!A1" }),
    (e: { code?: number }) => e.code === 404,
  );
});
