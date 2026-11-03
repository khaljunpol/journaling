import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAccountSets, planTabRename } from '../src/tabRename.ts';

test('findAccountSets groups tabs by account and ignores other tabs', () => {
  const sets = findAccountSets(['Logs_Sam', 'Activities_Sam', 'Logs_default', 'Notes']);
  assert.deepEqual(sets, [
    { account: 'Sam', tabs: ['Logs_Sam', 'Activities_Sam'] },
    { account: 'default', tabs: ['Logs_default'] },
  ]);
});

test('SidequestLogs_Alex belongs to SidequestLogs, not Sidequests', () => {
  const sets = findAccountSets(['SidequestLogs_Sam', 'Sidequests_Sam']);
  assert.deepEqual(sets, [{ account: 'Sam', tabs: ['SidequestLogs_Sam', 'Sidequests_Sam'] }]);
  assert.deepEqual(planTabRename(['SidequestLogs_Sam'], 'Sam').renames, [
    { from: 'SidequestLogs_Sam', to: 'SidequestLogs' },
  ]);
});

test('planTabRename skips when the plain tab exists', () => {
  assert.deepEqual(planTabRename(['Logs_Sam', 'Logs', 'Moods_Sam'], 'Sam'), {
    renames: [{ from: 'Moods_Sam', to: 'Moods' }],
    skipped: [{ from: 'Logs_Sam', reason: 'plain-exists' }],
  });
});

test('account with no tabs gives an empty plan', () => {
  assert.deepEqual(planTabRename(['Logs_Sam'], 'nobody'), { renames: [], skipped: [] });
});

test('BASES matches TABS', async () => {
  const { BASES } = await import('../src/tabRename.ts');
  const { TABS } = await import('../src/sheetLayout.ts');
  assert.deepEqual([...BASES].sort(), Object.values(TABS).sort());
});
