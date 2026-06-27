// Pure, dependency-free helpers so they can be unit-tested without pulling in
// next-auth / next/headers. The request-bound resolver lives in sheetContext.ts.

export type SheetAuthContext = {
  sheetAuth: {
    spreadsheetId: string;
  };
  account: string;
};

export type SessionLike = {
  user?: {
    email?: string | null;
  } | null;
} | null;

export type StoredSheetContextResult =
  | { ok: true; context: SheetAuthContext }
  | { ok: false; status: 401 | 403; message: string };

export function getSessionUserKey(session: SessionLike): string | null {
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
}

/**
 * Given the signed-in email and the connected sheet (from the connection cookie),
 * produce the sheet context or the right error.
 */
export function buildSheetContext(
  email: string | null,
  spreadsheetId: string | null,
  account: string | null,
): StoredSheetContextResult {
  if (!email) return { ok: false, status: 401, message: 'Unauthorized' };
  const id = spreadsheetId?.trim();
  if (!id) return { ok: false, status: 403, message: 'Setup required' };
  return {
    ok: true,
    context: {
      sheetAuth: { spreadsheetId: id },
      account: account?.trim() || 'default',
    },
  };
}
