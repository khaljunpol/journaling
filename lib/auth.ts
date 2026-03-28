import { SignJWT, jwtVerify } from 'jose';
import { SESSION_EXPIRY } from '@/lib/constants';

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing SESSION_SECRET');
  return new TextEncoder().encode(secret);
}

export async function issueSession() {
  const key = getSecretKey();
  const token = await new SignJWT({ sub: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(key);
  return token;
}

export async function verifySession(token: string) {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  return payload;
}
