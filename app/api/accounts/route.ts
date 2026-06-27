import { NextResponse } from 'next/server';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { getServiceSheets } from '@/lib/googleSheets';
import { getSheetContext } from '@/lib/server/sheetContext';

export async function GET() {
  try {
    const ctx = await getSheetContext();
    if (!ctx.ok) return apiError(ctx.message, ctx.status);

    const sheets = getServiceSheets();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: ctx.context.sheetAuth.spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const titles = (meta.data.sheets || [])
      .map((s) => s.properties?.title || '')
      .filter(Boolean);

    // Extract sub-account names from tab titles like "Activities_Alex" → "Alex"
    const accounts = Array.from(
      new Set(
        titles
          .map((t) => {
            const m = t.match(/^Activities_(.+)$/);
            return m ? m[1] : null;
          })
          .filter((x): x is string => x !== null),
      ),
    );

    return NextResponse.json(accounts);
  } catch (error: unknown) {
    console.error('[GET /api/accounts]', getErrorMessage(error));
    return apiError('Failed to fetch accounts', 503);
  }
}
