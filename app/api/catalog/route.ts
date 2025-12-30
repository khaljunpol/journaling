import { NextResponse } from 'next/server';
import { createCatalogItem, listCatalog } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await listCatalog();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const category = String(body?.category || '').trim();
    const tags = String(body?.tags || '').trim();
    if (!name || !category) return NextResponse.json({ error: 'name and category required' }, { status: 400 });
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
    }
    const created = await createCatalogItem(name, category, tags);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function OPTIONS() { return NextResponse.json({ ok: true }); }
export async function HEAD() { return NextResponse.json({ ok: true }); }
