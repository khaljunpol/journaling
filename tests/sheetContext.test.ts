import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getSessionUserKey,
  getStoredSheetContextForSession,
} from '../lib/server/sheetContext.ts';

describe('getSessionUserKey', () => {
  it('lowercases and trims the email', () => {
    assert.equal(getSessionUserKey({ user: { email: '  Foo@Bar.COM ' } }), 'foo@bar.com');
  });

  it('returns null when there is no email', () => {
    assert.equal(getSessionUserKey({ user: {} }), null);
    assert.equal(getSessionUserKey(null), null);
  });
});

describe('getStoredSheetContextForSession', () => {
  it('returns 401 when unauthenticated', () => {
    const result = getStoredSheetContextForSession(null);
    assert.deepEqual(result, { ok: false, status: 401, message: 'Unauthorized' });
  });

  it('returns 403 when authenticated but no spreadsheet is connected', () => {
    const result = getStoredSheetContextForSession({ user: { email: 'a@b.com' } });
    assert.deepEqual(result, { ok: false, status: 403, message: 'Setup required' });
  });

  it('builds the context from the session JWT state', () => {
    const result = getStoredSheetContextForSession({
      user: { email: 'a@b.com' },
      spreadsheetId: 'sheet_123',
      activeSubAccount: 'Alex',
    });
    assert.deepEqual(result, {
      ok: true,
      context: { sheetAuth: { spreadsheetId: 'sheet_123' }, account: 'Alex' },
    });
  });

  it('falls back to the default account when none is active', () => {
    const result = getStoredSheetContextForSession({
      user: { email: 'a@b.com' },
      spreadsheetId: 'sheet_123',
      activeSubAccount: null,
    });
    assert.equal(result.ok && result.context.account, 'default');
  });
});
