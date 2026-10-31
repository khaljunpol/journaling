import { upsertLog, getLogsBetween, getLogsForDate } from '@journaling/sheets/googleSheets';
import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function HEAD() {
  return NextResponse.json({}, { status: 200 });
}

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (date) {
      const logs = await getLogsForDate(ctx.sheetAuth, date);
      return NextResponse.json(logs, { status: 200 });
    }
    if (from && to) {
      const logs = await getLogsBetween(ctx.sheetAuth, from, to);
      return NextResponse.json(logs, { status: 200 });
    }
    return apiError('date or from+to required', 400);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/logs');
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const date = String(body?.date || '');
    const activityId = String(body?.activityId || '');
    const completed = Boolean(body?.completed);
    if (!date || !activityId) return apiError('date and activityId required', 400);
    await upsertLog(ctx.sheetAuth, date, activityId, completed);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/logs');
  }
}
