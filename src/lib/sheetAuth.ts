import { apiError } from '@/lib/apiHelpers';
import { getSheetContext } from '@/lib/server/sheetContext';
import { serviceTabsClient, type SheetAuth } from '@/lib/googleSheets';
import { ensureCoreTabsOnce } from '@/lib/sheetTabs';

export type { SheetAuth };

export type SheetContext = {
  sheetAuth: SheetAuth;
};

/**
 * Gets the sheet auth context from the current request, or returns an error response.
 * The first call per spreadsheet id (per server instance) also creates any missing core tabs.
 * Usage: const ctx = await requireSheetContext(); if ('status' in ctx) return ctx;
 */
export async function requireSheetContext(): Promise<SheetContext | ReturnType<typeof apiError>> {
  const result = await getSheetContext();
  if (!result.ok) return apiError(result.message, result.status);
  await ensureCoreTabsOnce(serviceTabsClient(), result.context.sheetAuth.spreadsheetId);
  return result.context;
}
