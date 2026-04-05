import { NextResponse } from 'next/server';
import { getMood, setMood, getMoodsBetween } from '@/lib/googleSheets';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
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
      const items = await getMoodsBetween(ctx.sheetAuth, ctx.account, from, to);
      return NextResponse.json(items);
    }
    if (!date) return apiError('date required', 400);
    const score = await getMood(ctx.sheetAuth, ctx.account, date);
    return NextResponse.json({ score });
  } catch (error: unknown) {
    console.error('[GET /api/moods]', getErrorMessage(error));
    return apiError('Failed to fetch moods', 503);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const date = String(body?.date || '');
    const scoreRaw = body?.score;
    const score = typeof scoreRaw === 'number' ? scoreRaw : parseInt(String(scoreRaw ?? ''), 10);
    if (!date) return apiError('date required', 400);
    if (!Number.isFinite(score) || score < 0 || score > 10) return apiError('score must be 0..10', 400);
    await setMood(ctx.sheetAuth, ctx.account, date, score);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/moods]', getErrorMessage(error));
    return apiError(getErrorMessage(error) || 'Unknown error', 500);
  }
}
