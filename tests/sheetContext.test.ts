import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSheetContext,
  getSessionUserKey,
} from '../lib/server/sheetContextCore.ts';

describe('getSessionUserKey', () => {
  it('lowercases and trims the email', () => {
    assert.equal(getSessionUserKey({ user: { email: '  Foo@Bar.COM ' } }), 'foo@bar.com');
  });

  it('returns null when there is no email', () => {
    assert.equal(getSessionUserKey({ user: {} }), null);
    assert.equal(getSessionUserKey(null), null);
  });
});

describe('buildSheetContext', () => {
  it('returns 401 when there is no signed-in email', () => {
    assert.deepEqual(buildSheetContext(null, 'sheet_123', 'Alex'), {
      ok: false,
      status: 401,
      message: 'Unauthorized',
    });
  });

  it('returns 403 when signed in but no sheet is connected', () => {
    assert.deepEqual(buildSheetContext('a@b.com', null, null), {
      ok: false,
      status: 403,
      message: 'Setup required',
    });
  });

  it('builds the context from the email + connection cookie values', () => {
    assert.deepEqual(buildSheetContext('a@b.com', 'sheet_123', 'Alex'), {
      ok: true,
      context: { sheetAuth: { spreadsheetId: 'sheet_123' }, account: 'Alex' },
    });
  });

  it('falls back to the default account when none is set', () => {
    const result = buildSheetContext('a@b.com', 'sheet_123', null);
    assert.equal(result.ok && result.context.account, 'default');
  });
});
