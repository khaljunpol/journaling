import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { parseFillDates } from '@/lib/server/gameInput';
import { requireSheetContext } from '@/lib/sheetAuth';
import { markFills } from '@journaling/sheets/googleSheets';

/** Marks days filled with "Fill usual habits": they earn +10 per habit but no perfect bonus. */
export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json().catch(() => null);
    const dates = parseFillDates(body?.dates);
    if (!dates) return apiError('dates must be 1 to 31 YYYY-MM-DD dates', 400);
    await markFills(ctx.sheetAuth, dates, new Date().toISOString());
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/game/fill');
  }
}
