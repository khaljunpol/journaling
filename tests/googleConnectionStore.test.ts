import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearGoogleConnection,
  decodeGoogleConnectionRecord,
  encodeGoogleConnectionRecord,
  getGoogleConnection,
  markGoogleConnectionReconnectRequired,
  saveGoogleConnection,
} from '../lib/server/googleConnectionStore.ts';

describe('google connection store', () => {
  it('saves, loads, and clears a connection', async () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';
    const userKey = `user-${Date.now()}-save-load`;

    await saveGoogleConnection(userKey, {
      email: 'Friend@Example.com',
      refreshToken: 'refresh-token-abc',
      accessToken: 'access-token-abc',
      accessTokenExpires: 12345,
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
    });

    const loaded = await getGoogleConnection(userKey);
    assert.equal(loaded?.email, 'friend@example.com');
    assert.equal(loaded?.refreshToken, 'refresh-token-abc');
    assert.equal(loaded?.accessToken, 'access-token-abc');
    assert.equal(loaded?.accessTokenExpires, 12345);
    assert.equal(loaded?.spreadsheetId, 'sheet-123');
    assert.equal(loaded?.activeSubAccount, 'Friend');
    assert.equal(loaded?.reconnectRequired, false);

    await clearGoogleConnection(userKey);
    assert.equal(await getGoogleConnection(userKey), null);
  });

  it('encodes refresh tokens without storing plaintext', () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';

    const encoded = encodeGoogleConnectionRecord({
      userKey: 'user-key',
      email: 'friend@example.com',
      refreshToken: 'refresh-token-secret',
      accessToken: 'access-token',
      accessTokenExpires: 999,
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
      reconnectRequired: false,
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T00:00:00.000Z',
    });

    assert.equal(encoded.includes('refresh-token-secret'), false);
    assert.equal(JSON.parse(encoded).encryptedRefreshToken.includes('refresh-token-secret'), false);
    assert.equal(decodeGoogleConnectionRecord(encoded).refreshToken, 'refresh-token-secret');
  });

  it('marks a connection as requiring reconnect', async () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';
    const userKey = `user-${Date.now()}-reconnect`;

    await saveGoogleConnection(userKey, {
      email: 'friend@example.com',
      refreshToken: 'refresh-token-abc',
      spreadsheetId: 'sheet-123',
      activeSubAccount: 'Friend',
    });

    await markGoogleConnectionReconnectRequired(userKey, 'invalid_grant');

    const loaded = await getGoogleConnection(userKey);
    assert.equal(loaded?.reconnectRequired, true);
    assert.equal(loaded?.reconnectReason, 'invalid_grant');
    assert.equal(loaded?.spreadsheetId, 'sheet-123');
    assert.equal(loaded?.refreshToken, 'refresh-token-abc');
  });
});
