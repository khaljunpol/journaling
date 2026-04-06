import { NextResponse } from 'next/server';
import { listHourLogs, upsertHourLog, upsertHourLogsBatch } from '@/lib/googleSheets';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { createApiCache } from '@/lib/apiCache';
import { HOUR_MAX, CATEGORY_MAX } from '@/lib/constants';

const cache = createApiCache(60_000);
const getKey = (account: string, date?: string | null, from?: string | null, to?: string | null) => {
  const scope = from && to ? `range:${from}-${to}` : (date ? `date:${date}` : 'all');
  return `hours:${account}|${scope}`;
};

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const key = getKey(ctx.account, date, from, to);
    const cached = cache.get(key);
    if (cached) return NextResponse.json(cached);
    if (date) {
      const items = await listHourLogs(ctx.sheetAuth, ctx.account, date, date);
      cache.set(key, items);
      return NextResponse.json(items);
    }
    if (from && to) {
      const items = await listHourLogs(ctx.sheetAuth, ctx.account, from, to);
      cache.set(key, items);
      return NextResponse.json(items);
    }
    const items = await listHourLogs(ctx.sheetAuth, ctx.account);
    cache.set(key, items);
    return NextResponse.json(items);
  } catch (error: unknown) {
    console.error('[GET /api/time]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const date = String(body?.date || '').slice(0, 10);
    if (!date) return apiError('date required', 400);

    if (Array.isArray(body?.entries)) {
      const entries = (body.entries as Array<any>).map((e) => ({
        hour: parseInt(String(e?.hour ?? '-1'), 10),
        category: parseInt(String(e?.category ?? '-1'), 10),
      }));
      for (const e of entries) {
        if (!Number.isFinite(e.hour) || e.hour < 0 || e.hour > HOUR_MAX) return apiError('hour must be 0..23', 400);
        if (!Number.isFinite(e.category) || e.category < 0 || e.category > CATEGORY_MAX) return apiError('category must be 0..11', 400);
      }
      const saved = await upsertHourLogsBatch(ctx.sheetAuth, ctx.account, { date, entries });
      cache.invalidate();
      return NextResponse.json(saved, { status: 201 });
    }

    const hour = parseInt(String(body?.hour ?? '-1'), 10);
    const category = parseInt(String(body?.category ?? '-1'), 10);
    if (!Number.isFinite(hour) || hour < 0 || hour > HOUR_MAX) return apiError('hour must be 0..23', 400);
    if (!Number.isFinite(category) || category < 0 || category > CATEGORY_MAX) return apiError('category must be 0..11', 400);
    const saved = await upsertHourLog(ctx.sheetAuth, ctx.account, { date, hour, category });
    cache.invalidate();
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/time]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
