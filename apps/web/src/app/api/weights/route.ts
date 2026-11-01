import { NextResponse } from 'next/server';
import { getWeight, setWeight, getWeightsBetween } from '@journaling/sheets/googleSheets';
import { stampFrom } from '@/lib/server/stamp';
import { apiError, apiFailure } from '@/lib/apiHelpers';
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
      const series = await getWeightsBetween(ctx.sheetAuth, from, to);
      return NextResponse.json(series);
    }
    if (!date) return apiError('date required', 400);
    const weight = await getWeight(ctx.sheetAuth, date);
    return NextResponse.json({ weight });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/weights');
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
    await setWeight(ctx.sheetAuth, date, weight);
    await stampFrom(req, ctx.sheetAuth, date, 'weight');
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/weights');
  }
}
