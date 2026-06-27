import { auth } from '@/lib/auth';
import { readSheetConnection } from './sheetConnection.ts';
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
  const { spreadsheetId, account } = await readSheetConnection();
  return buildSheetContext(email, spreadsheetId, account);
}
