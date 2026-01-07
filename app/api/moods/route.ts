import { NextResponse } from 'next/server';
import { getMood, setMood, getMoodsBetween } from '@/lib/googleSheets';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from && to) {
      const items = await getMoodsBetween(account, from, to);
      return NextResponse.json(items);
    }
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
    const score = await getMood(account, date);
    return NextResponse.json({ score });
  } catch (e: any) {
    return NextResponse.json({ score: null }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const date = String(body?.date || '');
    const scoreRaw = body?.score;
    const score = typeof scoreRaw === 'number' ? scoreRaw : parseInt(String(scoreRaw ?? ''), 10);
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
    if (!Number.isFinite(score) || score < 0 || score > 10) return NextResponse.json({ error: 'score must be 0..10' }, { status: 400 });
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
    }
    await setMood(account, date, score);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
