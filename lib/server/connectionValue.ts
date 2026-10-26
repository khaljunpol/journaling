/**
 * What the sheet-connection cookie holds. Pure, so it is testable without
 * Next's cookie store. Copied from listing-tracker connection-value.ts.
 *
 * The email ties the cookie to the person who connected it, so the next
 * person on the same browser does not inherit their sheet. A cookie from
 * before this change is a bare sheet ID: it reads as robot mode, no email.
 */
export type SheetMode = 'robot' | 'user';
export type Connection = { id: string; mode: SheetMode; email: string | null };

/** Sheet IDs are URL-safe base64-like strings. */
const ID = /^[A-Za-z0-9_-]+$/;

export function encodeConnection(c: { id: string; mode: SheetMode; email: string }): string {
  return JSON.stringify({ id: c.id, mode: c.mode, email: c.email.trim().toLowerCase() });
}

export function decodeConnection(raw: string | undefined): Connection | null {
  if (!raw) return null;
  if (!raw.startsWith('{')) return ID.test(raw) ? { id: raw, mode: 'robot', email: null } : null;
  try {
    const v = JSON.parse(raw) as { id?: unknown; mode?: unknown; email?: unknown };
    if (typeof v.id !== 'string' || !ID.test(v.id)) return null;
    if (v.mode !== 'robot' && v.mode !== 'user') return null;
    const email = typeof v.email === 'string' && v.email ? v.email.trim().toLowerCase() : null;
    return { id: v.id, mode: v.mode, email };
  } catch {
    return null;
  }
}

/** The connection, if the signed-in person may use it. A bare legacy ID passes. */
export function connectionFor(c: Connection | null, email: string): Connection | null {
  if (!c) return null;
  if (c.email === null) return c.mode === 'robot' ? c : null;
  return c.email === email.trim().toLowerCase() ? c : null;
}
