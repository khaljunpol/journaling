import { NextResponse } from 'next/server';
import { setHighlight, getHighlight, getHighlightsBetween } from '@/lib/googleSheets';
import { apiError, MAX_LEN, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from && to) {
      const items = await getHighlightsBetween(ctx.sheetAuth, from, to);
      return NextResponse.json(items);
    }
    if (!date) return apiError('date required', 400);
    const text = await getHighlight(ctx.sheetAuth, date);
    return NextResponse.json({ text });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/highlights');
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const date = String(body?.date || '');
    const text = String(body?.text || '');
    if (!date) return apiError('date required', 400);
    if (text.length > MAX_LEN.text) return apiError(`text must be ≤${MAX_LEN.text} characters`, 400);
    await setHighlight(ctx.sheetAuth, date, text);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/highlights');
  }
}
