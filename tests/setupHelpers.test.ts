import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSpreadsheetId } from '../src/lib/setup.ts';

describe('setup helpers', () => {
  it('extracts spreadsheet IDs from full Google Sheets URLs', () => {
    assert.equal(
      parseSpreadsheetId('https://docs.google.com/spreadsheets/d/sheet_123-abc/edit#gid=0'),
      'sheet_123-abc',
    );
  });

  it('accepts a bare spreadsheet ID', () => {
    assert.equal(parseSpreadsheetId(' sheet_123-abc '), 'sheet_123-abc');
  });

  it('returns an empty string for empty input', () => {
    assert.equal(parseSpreadsheetId('   '), '');
  });
});
