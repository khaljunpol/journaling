import { NextResponse } from 'next/server';
import { getConsistencyMetrics } from '@journaling/sheets/googleSheets';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const data = await getConsistencyMetrics(ctx.sheetAuth);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/metrics');
  }
}
