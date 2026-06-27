import { cookies } from 'next/headers';

// The connected sheet lives in durable httpOnly cookies set by the server. This avoids
// next-auth v5 beta's unreliable session.update() persistence (the spreadsheet id was
// vanishing from the JWT on reload) and needs no external store.
const SHEET_ID_COOKIE = 'journal_sheet_id';
const SHEET_ACCOUNT_COOKIE = 'journal_sheet_account';
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
  account: string | null;
};

export async function readSheetConnection(): Promise<SheetConnection> {
  const store = await cookies();
  return {
    spreadsheetId: store.get(SHEET_ID_COOKIE)?.value || null,
    account: store.get(SHEET_ACCOUNT_COOKIE)?.value || null,
  };
}

export async function writeSheetConnection(spreadsheetId: string, account: string): Promise<void> {
  const store = await cookies();
  store.set(SHEET_ID_COOKIE, spreadsheetId, cookieOptions());
  store.set(SHEET_ACCOUNT_COOKIE, account, cookieOptions());
}

export async function setActiveAccount(account: string): Promise<void> {
  const store = await cookies();
  store.set(SHEET_ACCOUNT_COOKIE, account, cookieOptions());
}

export async function clearSheetConnection(): Promise<void> {
  const store = await cookies();
  store.delete(SHEET_ID_COOKIE);
  store.delete(SHEET_ACCOUNT_COOKIE);
}
