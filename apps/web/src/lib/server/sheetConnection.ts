import { cookies } from 'next/headers';
import { connectionFor, decodeConnection, encodeConnection } from './connectionValue.ts';

// The connected sheet lives in durable httpOnly cookies set by the server. This avoids
// next-auth v5 beta's unreliable session.update() persistence (the spreadsheet id was
// vanishing from the JWT on reload) and needs no external store.
const SHEET_ID_COOKIE = 'journal_sheet_id';
// Old sub-account cookie: no longer read, deleted on every write or clear.
const OLD_ACCOUNT_COOKIE = 'journal_sheet_account';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  };
}

export type SheetConnection = {
  spreadsheetId: string | null;
  /** True when the cookie is an old bare id (no email yet); callers should rewrite it. */
  legacy: boolean;
};

export async function readSheetConnection(email: string): Promise<SheetConnection> {
  const store = await cookies();
  const decoded = decodeConnection(store.get(SHEET_ID_COOKIE)?.value);
  const conn = connectionFor(decoded, email);
  return {
    spreadsheetId: conn?.id ?? null,
    legacy: !!conn && conn.email === null,
  };
}

export async function writeSheetConnection(
  spreadsheetId: string,
  email: string,
): Promise<void> {
  const store = await cookies();
  store.set(
    SHEET_ID_COOKIE,
    encodeConnection({ id: spreadsheetId, mode: 'robot', email }),
    cookieOptions(),
  );
  store.delete(OLD_ACCOUNT_COOKIE);
}

export async function clearSheetConnection(): Promise<void> {
  const store = await cookies();
  store.delete(SHEET_ID_COOKIE);
  store.delete(OLD_ACCOUNT_COOKIE);
}
