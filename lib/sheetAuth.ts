import { auth } from '@/lib/auth';
import { apiError } from '@/lib/apiHelpers';
import { getStoredSheetContextForSession } from '@/lib/server/sheetContext';
import type { SheetAuth } from '@/lib/googleSheets';

export type { SheetAuth };

export type SheetContext = {
  sheetAuth: SheetAuth;
  account: string;
};

/**
 * Gets the sheet auth context from the current session, or returns an error response.
 * Usage: const ctx = await requireSheetContext(); if ('status' in ctx) return ctx;
 */
export async function requireSheetContext(): Promise<SheetContext | ReturnType<typeof apiError>> {
  const session = await auth();
  const result = await getStoredSheetContextForSession(session);
  return result.ok ? result.context : apiError(result.message, result.status);
}
