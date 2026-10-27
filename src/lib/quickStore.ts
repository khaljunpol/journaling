// Browser-only localStorage wrapper for the /quick snapshot and outbox.
// Every key starts with 'quick:'. clearLocalCache() wipes them too, and signOutClean also calls clearQuick().
import type { QuickPayload } from './quickPayload';
import type { OutboxItem } from './outbox';

const PREFIX = 'quick:';
const snapKey = (email: string) => `${PREFIX}snapshot:${email.toLowerCase()}`;
const outKey = (email: string) => `${PREFIX}outbox:${email.toLowerCase()}`;

function store(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored (no storage, private mode, quota). */
function write(key: string, value: unknown): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const LAST_EMAIL = PREFIX + 'lastEmail';

/** Last signed-in email, so the board can open before the session loads (or offline). */
export function getLastEmail(): string | null {
  const v = read<string>(LAST_EMAIL);
  return typeof v === 'string' && v ? v : null;
}

export function setLastEmail(email: string): void {
  write(LAST_EMAIL, email.toLowerCase());
}

export function loadSnapshot(email: string): QuickPayload | null {
  return read<QuickPayload>(snapKey(email));
}

export function saveSnapshot(email: string, payload: QuickPayload): boolean {
  return write(snapKey(email), payload);
}

export function loadOutbox(email: string): OutboxItem[] {
  const v = read<OutboxItem[]>(outKey(email));
  return Array.isArray(v) ? v : [];
}

/** Like loadOutbox, but null when storage cannot be read (so callers skip merging instead of assuming empty). */
export function readOutbox(email: string): OutboxItem[] | null {
  try {
    const s = store();
    if (!s) return null;
    const raw = s.getItem(outKey(email));
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as OutboxItem[]) : [];
  } catch {
    return null;
  }
}

export function saveOutbox(email: string, q: OutboxItem[]): boolean {
  return write(outKey(email), q);
}

/** Remove every quick:* key (all users on this browser). Never throws. */
export function clearQuick(): void {
  try {
    const s = store();
    if (!s) return;
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k !== null && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch { /* storage unavailable */ }
}
