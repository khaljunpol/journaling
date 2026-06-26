import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function getKey(): Buffer {
  const secret = process.env.CONNECTION_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('CONNECTION_ENCRYPTION_SECRET or AUTH_SECRET is required');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string): string {
  try {
    const [version, iv, authTag, encrypted] = payload.split(':');
    if (version !== VERSION || !iv || !authTag || !encrypted) {
      throw new Error('Unsupported encrypted secret payload');
    }

    const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Invalid encrypted secret');
  }
}
