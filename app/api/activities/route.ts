import { NextResponse } from 'next/server';
import { createActivity, listActivities } from '@/lib/googleSheets';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const data = await listActivities(account);
    return NextResponse.json(data);
  } catch (e: any) {
    // Fallback to empty list if Sheets config is missing or fails
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
    }
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const created = await createActivity(account, name);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
