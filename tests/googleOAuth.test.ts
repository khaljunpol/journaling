import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getGoogleConnection,
  saveGoogleConnection,
} from '../lib/server/googleConnectionStore.ts';
import { getSheetAuthForUser } from '../lib/server/googleOAuth.ts';

describe('google oauth sheet auth resolution', () => {
  it('reuses a valid stored access token', async () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';
    const userKey = `user-${Date.now()}-valid-token`;
    let refreshCalls = 0;

    await saveGoogleConnection(userKey, {
      email: 'friend@example.com',
      refreshToken: 'refresh-token-abc',
      accessToken: 'access-token-abc',
      accessTokenExpires: Date.now() + 60 * 60 * 1000,
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
    });

    const result = await getSheetAuthForUser(userKey, async () => {
      refreshCalls += 1;
      return { accessToken: 'new-access-token', accessTokenExpires: Date.now() + 60 * 60 * 1000 };
    });

    assert.equal(result.ok, true);
    assert.equal(refreshCalls, 0);
    if (result.ok) assert.equal(result.context.sheetAuth.accessToken, 'access-token-abc');
  });

  it('refreshes and persists an expired access token', async () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';
    const userKey = `user-${Date.now()}-expired-token`;

    await saveGoogleConnection(userKey, {
      email: 'friend@example.com',
      refreshToken: 'refresh-token-abc',
      accessToken: 'old-access-token',
      accessTokenExpires: Date.now() - 1000,
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
    });

    const result = await getSheetAuthForUser(userKey, async (refreshToken) => {
      assert.equal(refreshToken, 'refresh-token-abc');
      return {
        accessToken: 'new-access-token',
        accessTokenExpires: Date.now() + 60 * 60 * 1000,
      };
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.context.sheetAuth.accessToken, 'new-access-token');

    const stored = await getGoogleConnection(userKey);
    assert.equal(stored?.accessToken, 'new-access-token');
    assert.equal(stored?.reconnectRequired, false);
  });

  it('marks reconnect required on invalid_grant', async () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';
    const userKey = `user-${Date.now()}-invalid-grant`;

    await saveGoogleConnection(userKey, {
      email: 'friend@example.com',
      refreshToken: 'refresh-token-abc',
      accessToken: 'old-access-token',
      accessTokenExpires: Date.now() - 1000,
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
    });

    const result = await getSheetAuthForUser(userKey, async () => {
      throw Object.assign(new Error('invalid_grant'), {
        response: { data: { error: 'invalid_grant' } },
      });
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.message, 'Reconnect Google');
    }

    const stored = await getGoogleConnection(userKey);
    assert.equal(stored?.reconnectRequired, true);
    assert.equal(stored?.reconnectReason, 'invalid_grant');
  });
});
