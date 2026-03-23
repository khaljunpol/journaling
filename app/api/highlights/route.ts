import { NextResponse } from 'next/server';
import { setHighlight, getHighlight, getHighlightsBetween } from '@/lib/googleSheets';
import { apiError, getAccountParam, MAX_LEN } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from && to) {
      const items = await getHighlightsBetween(account, from, to);
      return NextResponse.json(items);
    }
    if (!date) return apiError('date required', 400);
    const text = await getHighlight(account, date);
    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('[GET /api/highlights]', e);
    return apiError('Failed to fetch highlights', 503);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const date = String(body?.date || '');
    const text = String(body?.text || '');
    if (!date) return apiError('date required', 400);
    if (text.length > MAX_LEN.text) return apiError(`text must be ≤${MAX_LEN.text} characters`, 400);
    await setHighlight(account, date, text);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/highlights]', e);
    const msg = String(e?.message || '');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return apiError('Google Sheets not configured', 503);
    }
    return apiError(msg || 'Unknown error', 500);
  }
}
