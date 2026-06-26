import { NextResponse } from 'next/server';
import { listHourLogs, upsertHourLog, upsertHourLogsBatch } from '@/lib/googleSheets';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { createApiCache } from '@/lib/apiCache';
import { parseTimeEntry } from '@/lib/time';

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
      const entries = [];
      for (const raw of body.entries as Array<any>) {
        const parsed = parseTimeEntry({ hour: raw?.hour, category: raw?.category });
        if (!parsed.ok) return apiError(parsed.message, 400);
        entries.push(parsed.entry);
      }
      const saved = await upsertHourLogsBatch(ctx.sheetAuth, ctx.account, { date, entries });
      cache.invalidate();
      return NextResponse.json(saved, { status: 201 });
    }

    const parsed = parseTimeEntry({ hour: body?.hour, category: body?.category });
    if (!parsed.ok) return apiError(parsed.message, 400);
    const saved = await upsertHourLog(ctx.sheetAuth, ctx.account, { date, ...parsed.entry });
    cache.invalidate();
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/time]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
