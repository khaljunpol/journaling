import { isEmailAllowed } from './allowlist.ts';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** New widget secret: 32 random bytes, base64url. */
export function makeSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of the secret. Only this is stored in the sheet. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Constant-time check. False for any bad hash format or length. */
export function secretMatches(hash: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(hash)) return false;
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(hashSecret(secret), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Split "<spreadsheetId>.<secret>" on the last dot. */
export function parseKey(key: string): { spreadsheetId: string; secret: string } | null {
  const i = key.lastIndexOf('.');
  if (i < 1 || i === key.length - 1) return null;
  const spreadsheetId = key.slice(0, i);
  const secret = key.slice(i + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(spreadsheetId)) return null;
  return { spreadsheetId, secret };
}

/** Connection code: base64 of JSON { url, key }. */
export function encodeCode(url: string, key: string): string {
  return Buffer.from(JSON.stringify({ url, key })).toString('base64');
}

/** Reverse of encodeCode. Null on any parse error or bad shape. */
export function decodeCode(code: string): { url: string; key: string } | null {
  try {
    const v = JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
    if (!v || typeof v.url !== 'string' || typeof v.key !== 'string') return null;
    if (!v.url || !v.key) return null;
    return { url: v.url, key: v.key };
  } catch {
    return null;
  }
}

/** Cheap shape check before any sheet read: a real secret is 43 base64url chars, a sheet id 20–100. */
export function keyLooksValid(k: { spreadsheetId: string; secret: string }): boolean {
  return /^[A-Za-z0-9_-]{20,100}$/.test(k.spreadsheetId) && /^[A-Za-z0-9_-]{43}$/.test(k.secret);
}

/**
 * Caps sheet reads for sheet ids that never passed the key check, so junk keys
 * cannot burn the service account's read quota. Sliding window; refused calls are not counted.
 */
export function makeReadGate(opts: { limit: number; windowMs: number; now: () => number; maxTrusted?: number }) {
  const trusted = new Set<string>();
  const maxTrusted = opts.maxTrusted ?? 100;
  let reads: number[] = [];
  return {
    allow(spreadsheetId: string): boolean {
      if (trusted.has(spreadsheetId)) return true;
      const t = opts.now();
      reads = reads.filter((r) => t - r < opts.windowMs);
      if (reads.length >= opts.limit) return false;
      reads.push(t);
      return true;
    },
    trust(spreadsheetId: string): void {
      if (trusted.size >= maxTrusted && !trusted.has(spreadsheetId)) return;
      trusted.add(spreadsheetId);
    },
  };
}

/** Key decision from the sheet's settings: a stored hash, a matching secret, and an owner who is still allowed. */
export function decideWidgetKey(settings: Record<string, string>, secret: string, allowed: string[]): boolean {
  const hash = settings.widgetKeyHash ?? '';
  const owner = (settings.ownerEmail ?? '').trim().toLowerCase();
  return !!hash && secretMatches(hash, secret) && isEmailAllowed(owner, allowed);
}
