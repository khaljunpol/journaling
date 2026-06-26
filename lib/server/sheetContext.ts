import { getSheetAuthForUser } from './googleOAuth.ts';

export type SheetAuthContext = {
  sheetAuth: {
    accessToken: string;
    refreshToken: string;
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

export async function getStoredSheetContextForSession(
  session: SessionLike,
): Promise<StoredSheetContextResult> {
  const userKey = getSessionUserKey(session);
  if (!userKey) return { ok: false, status: 401, message: 'Unauthorized' };

  return getSheetAuthForUser(userKey);
}
