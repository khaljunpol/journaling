import { NextResponse } from 'next/server';
import { getMood, setMood, getMoodsBetween } from '@/lib/googleSheets';
import { apiError, getAccountParam, getErrorMessage } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from && to) {
      const items = await getMoodsBetween(account, from, to);
      return NextResponse.json(items);
    }
    if (!date) return apiError('date required', 400);
    const score = await getMood(account, date);
    return NextResponse.json({ score });
  } catch (error: unknown) {
    console.error('[GET /api/moods]', getErrorMessage(error));
    return apiError('Failed to fetch moods', 503);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const date = String(body?.date || '');
    const scoreRaw = body?.score;
    const score = typeof scoreRaw === 'number' ? scoreRaw : parseInt(String(scoreRaw ?? ''), 10);
    if (!date) return apiError('date required', 400);
    if (!Number.isFinite(score) || score < 0 || score > 10) return apiError('score must be 0..10', 400);
    await setMood(account, date, score);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    console.error('[POST /api/moods]', msg);
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return apiError('Google Sheets not configured', 503);
    }
    return apiError(msg || 'Unknown error', 500);
  }
}
