import { NextResponse } from 'next/server';
import { getWeight, setWeight, getWeightsBetween } from '@/lib/googleSheets';
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
      const series = await getWeightsBetween(ctx.sheetAuth, ctx.account, from, to);
      return NextResponse.json(series);
    }
    if (!date) return apiError('date required', 400);
    const weight = await getWeight(ctx.sheetAuth, ctx.account, date);
    return NextResponse.json({ weight });
  } catch (error: unknown) {
    console.error('[GET /api/weights]', getErrorMessage(error));
    return apiError('Failed to fetch weights', 503);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const date = String(body?.date || '');
    const weightRaw = body?.weight;
    const weight = typeof weightRaw === 'number' ? weightRaw : parseFloat(String(weightRaw ?? ''));
    if (!date) return apiError('date required', 400);
    if (!Number.isFinite(weight)) return apiError('weight must be a number', 400);
    await setWeight(ctx.sheetAuth, ctx.account, date, weight);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/weights]', getErrorMessage(error));
    return apiError(getErrorMessage(error) || 'Unknown error', 500);
  }
}
