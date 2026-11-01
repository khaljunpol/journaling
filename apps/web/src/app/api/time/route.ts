import { NextResponse } from 'next/server';
import { listHourLogs, upsertHourLog, upsertHourLogsBatch } from '@journaling/sheets/googleSheets';
import { prepareStamp } from '@/lib/server/stamp';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { parseTimeEntry } from '@/lib/time';

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (date) {
      const items = await listHourLogs(ctx.sheetAuth, date, date);
      return NextResponse.json(items);
    }
    if (from && to) {
      const items = await listHourLogs(ctx.sheetAuth, from, to);
      return NextResponse.json(items);
    }
    const items = await listHourLogs(ctx.sheetAuth);
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
      const stamp = await prepareStamp(req, ctx.sheetAuth, date, 'hours');
      const saved = await upsertHourLogsBatch(ctx.sheetAuth, { date, entries });
      if (entries.length) await stamp();
      return NextResponse.json(saved, { status: 201 });
    }

    const parsed = parseTimeEntry({ hour: body?.hour, category: body?.category });
    if (!parsed.ok) return apiError(parsed.message, 400);
    const stamp = await prepareStamp(req, ctx.sheetAuth, date, 'hours');
    const saved = await upsertHourLog(ctx.sheetAuth, { date, ...parsed.entry });
    await stamp();
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/time');
  }
}
