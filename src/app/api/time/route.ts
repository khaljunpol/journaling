import { NextResponse } from 'next/server';
import { listHourLogs, upsertHourLog, upsertHourLogsBatch } from '@/lib/googleSheets';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { createApiCache, cacheKey } from '@/lib/apiCache';
import { parseTimeEntry } from '@/lib/time';

const cache = createApiCache(60_000);
const getKey = (spreadsheetId: string, date?: string | null, from?: string | null, to?: string | null) => {
  const scope = from && to ? `range:${from}-${to}` : (date ? `date:${date}` : 'all');
  return cacheKey(spreadsheetId, 'hours', scope);
};

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const key = getKey(ctx.sheetAuth.spreadsheetId, date, from, to);
    const cached = cache.get(key);
    if (cached) return NextResponse.json(cached);
    if (date) {
      const items = await listHourLogs(ctx.sheetAuth, date, date);
      cache.set(key, items);
      return NextResponse.json(items);
    }
    if (from && to) {
      const items = await listHourLogs(ctx.sheetAuth, from, to);
      cache.set(key, items);
      return NextResponse.json(items);
    }
    const items = await listHourLogs(ctx.sheetAuth);
    cache.set(key, items);
    return NextResponse.json(items);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/time');
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
      const entries = [];
      for (const raw of body.entries as Array<any>) {
        const parsed = parseTimeEntry({ hour: raw?.hour, category: raw?.category });
        if (!parsed.ok) return apiError(parsed.message, 400);
        entries.push(parsed.entry);
      }
      const saved = await upsertHourLogsBatch(ctx.sheetAuth, { date, entries });
      cache.invalidate();
      return NextResponse.json(saved, { status: 201 });
    }

    const parsed = parseTimeEntry({ hour: body?.hour, category: body?.category });
    if (!parsed.ok) return apiError(parsed.message, 400);
    const saved = await upsertHourLog(ctx.sheetAuth, { date, ...parsed.entry });
    cache.invalidate();
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/time');
  }
}
