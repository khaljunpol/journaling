import { NextResponse } from 'next/server';
import { getConsistencyMetrics } from '@/lib/googleSheets';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const data = await getConsistencyMetrics(ctx.sheetAuth, ctx.account);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[GET /api/metrics]', getErrorMessage(error));
    return apiError('Failed to fetch metrics', 503);
  }
}
