import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { saveGoogleConnection } from '../lib/server/googleConnectionStore.ts';
import { getSessionUserKey, getStoredSheetContextForSession } from '../lib/server/sheetContext.ts';

describe('sheet auth context resolution', () => {
  it('derives a stable user key from the session email', () => {
    assert.equal(getSessionUserKey({ user: { email: ' Friend@Example.com ' } }), 'friend@example.com');
    assert.equal(getSessionUserKey({ user: { email: '' } }), null);
    assert.equal(getSessionUserKey(null), null);
  });

  it('returns setup-required when a signed-in user has no stored connection', async () => {
    const result = await getStoredSheetContextForSession({
      user: { email: `missing-${Date.now()}@example.com` },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
      assert.equal(result.message, 'Setup required');
    }
  });

  it('returns sheet auth from the stored connection', async () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';
    const email = `friend-${Date.now()}@example.com`;

    await saveGoogleConnection(email, {
      email,
      refreshToken: 'refresh-token-abc',
      accessToken: 'access-token-abc',
      accessTokenExpires: Date.now() + 60 * 60 * 1000,
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
    });

    const result = await getStoredSheetContextForSession({ user: { email } });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.context.sheetAuth, {
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-abc',
        spreadsheetId: 'sheet-123',
      });
      assert.equal(result.context.account, 'Friend');
    }
  });
});
