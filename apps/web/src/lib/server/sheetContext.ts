import { auth } from '@/lib/auth';
import { demoSheetId, isDemo } from '@/lib/demo';
import { readSheetConnection, writeSheetConnection } from './sheetConnection.ts';
import { buildSheetContext, getSessionUserKey } from './sheetContextCore.ts';

export type {
  SheetAuthContext,
  SessionLike,
  StoredSheetContextResult,
} from './sheetContextCore.ts';
export { buildSheetContext, getSessionUserKey } from './sheetContextCore.ts';

/**
 * Resolves the sheet context for the current request: requires a signed-in user
 * (NextAuth) and a connected spreadsheet (durable cookie). No server store, no token
 * refresh — sheet access is handled by the shared service account.
 */
export async function getSheetContext() {
  const session = await auth();
  const email = getSessionUserKey(session);
  if (!email) return { ...buildSheetContext(null, null), email: null };
  // Demo: each visitor has their own sandbox sheet; no connection cookie.
  if (isDemo()) return { ...buildSheetContext(email, demoSheetId(email)), email };
  const { spreadsheetId, legacy } = await readSheetConnection(email);
  if (legacy && spreadsheetId) {
    // Upgrade the old bare-id cookie. Cookies are read-only outside route handlers,
    // so a failed rewrite is fine: the bare id keeps working until the next write.
    try {
      await writeSheetConnection(spreadsheetId, email);
    } catch { /* read-only cookie store */ }
  }
  return { ...buildSheetContext(email, spreadsheetId), email };
}
