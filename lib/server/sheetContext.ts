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
  spreadsheetId?: string | null;
  activeSubAccount?: string | null;
} | null;

export type StoredSheetContextResult =
  | { ok: true; context: SheetAuthContext }
  | { ok: false; status: 401 | 403; message: string };

export function getSessionUserKey(session: SessionLike): string | null {
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
}

/**
 * Builds the sheet context from the session. The connected spreadsheet id and active
 * sub-account live in the JWT (durable cookie), so there is no server-side store and no
 * token to refresh — sheet access is handled by the shared service account.
 */
export function getStoredSheetContextForSession(
  session: SessionLike,
): StoredSheetContextResult {
  const userKey = getSessionUserKey(session);
  if (!userKey) return { ok: false, status: 401, message: 'Unauthorized' };

  const spreadsheetId = session?.spreadsheetId?.trim();
  if (!spreadsheetId) return { ok: false, status: 403, message: 'Setup required' };

  return {
    ok: true,
    context: {
      sheetAuth: { spreadsheetId },
      account: session?.activeSubAccount?.trim() || 'default',
    },
  };
}
