import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decryptSecret, encryptSecret } from '../lib/server/connectionCrypto.ts';

describe('connection secret encryption', () => {
  it('round-trips a secret without exposing plaintext in the payload', () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';

    const encrypted = encryptSecret('refresh-token-123');

    assert.notEqual(encrypted, 'refresh-token-123');
    assert.equal(encrypted.includes('refresh-token-123'), false);
    assert.equal(decryptSecret(encrypted), 'refresh-token-123');
  });

  it('uses a random iv for each encryption', () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';

    const first = encryptSecret('same-token');
    const second = encryptSecret('same-token');

    assert.notEqual(first, second);
    assert.equal(decryptSecret(first), 'same-token');
    assert.equal(decryptSecret(second), 'same-token');
  });

  it('rejects malformed payloads', () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = 'test-secret-with-enough-entropy';

    assert.throws(() => decryptSecret('not-a-valid-payload'), /Invalid encrypted secret/);
  });
});
