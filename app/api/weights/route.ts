import { NextResponse } from 'next/server';
import { getWeight, setWeight, getWeightsBetween } from '@/lib/googleSheets';
import { apiError, getAccountParam } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from && to) {
      const series = await getWeightsBetween(account, from, to);
      return NextResponse.json(series);
    }
    if (!date) return apiError('date required', 400);
    const weight = await getWeight(account, date);
    return NextResponse.json({ weight });
  } catch (e: any) {
    console.error('[GET /api/weights]', e);
    return apiError('Failed to fetch weights', 503);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const date = String(body?.date || '');
    const weightRaw = body?.weight;
    const weight = typeof weightRaw === 'number' ? weightRaw : parseFloat(String(weightRaw ?? ''));
    if (!date) return apiError('date required', 400);
    if (!Number.isFinite(weight)) return apiError('weight must be a number', 400);
    await setWeight(account, date, weight);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/weights]', e);
    const msg = String(e?.message || '');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return apiError('Google Sheets not configured', 503);
    }
    return apiError(msg || 'Unknown error', 500);
  }
}
