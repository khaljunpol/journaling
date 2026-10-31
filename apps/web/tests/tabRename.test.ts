import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAccountSets, planTabRename } from '../src/lib/tabRename.ts';

test('findAccountSets groups tabs by account and ignores other tabs', () => {
  const sets = findAccountSets(['Logs_Alex', 'Activities_Alex', 'Logs_default', 'Notes']);
  assert.deepEqual(sets, [
    { account: 'Alex', tabs: ['Logs_Alex', 'Activities_Alex'] },
    { account: 'default', tabs: ['Logs_default'] },
  ]);
});

test('SidequestLogs_Alex belongs to SidequestLogs, not Sidequests', () => {
  const sets = findAccountSets(['SidequestLogs_Alex', 'Sidequests_Alex']);
  assert.deepEqual(sets, [{ account: 'Alex', tabs: ['SidequestLogs_Alex', 'Sidequests_Alex'] }]);
  assert.deepEqual(planTabRename(['SidequestLogs_Alex'], 'Alex').renames, [
    { from: 'SidequestLogs_Alex', to: 'SidequestLogs' },
  ]);
});

test('planTabRename skips when the plain tab exists', () => {
  assert.deepEqual(planTabRename(['Logs_Alex', 'Logs', 'Moods_Alex'], 'Alex'), {
    renames: [{ from: 'Moods_Alex', to: 'Moods' }],
    skipped: [{ from: 'Logs_Alex', reason: 'plain-exists' }],
  });
});

test('account with no tabs gives an empty plan', () => {
  assert.deepEqual(planTabRename(['Logs_Alex'], 'nobody'), { renames: [], skipped: [] });
});

test('BASES matches TABS', async () => {
  const { BASES } = await import('../src/lib/tabRename.ts');
  const { TABS } = await import('../src/lib/sheetLayout.ts');
  assert.deepEqual([...BASES].sort(), Object.values(TABS).sort());
});
