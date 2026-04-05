import { auth } from '@/lib/auth';
import { apiError } from '@/lib/apiHelpers';
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
  if (!session?.accessToken) return apiError('Unauthorized', 401);
  if (!session.spreadsheetId) return apiError('Setup required', 403);
  return {
    sheetAuth: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      spreadsheetId: session.spreadsheetId,
    },
    account: session.activeSubAccount || 'default',
  };
}
