import { NextResponse } from 'next/server';
import { createCatalogItem, listCatalog } from '@/lib/googleSheets';
import { apiError, MAX_LEN } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await listCatalog();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[GET /api/catalog]', e);
    return apiError('Failed to fetch catalog', 503);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const category = String(body?.category || '').trim();
    const tags = String(body?.tags || '').trim();
    if (!name || !category) return apiError('name and category required', 400);
    if (name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    if (category.length > MAX_LEN.category) return apiError(`category must be ≤${MAX_LEN.category} characters`, 400);
    if (tags.length > MAX_LEN.tags) return apiError(`tags must be ≤${MAX_LEN.tags} characters`, 400);
    const created = await createCatalogItem(name, category, tags);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/catalog]', e);
    const msg = String(e?.message || '');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return apiError('Google Sheets not configured', 503);
    }
    return apiError(msg || 'Unknown error', 500);
  }
}

export async function OPTIONS() { return NextResponse.json({ ok: true }); }
export async function HEAD() { return NextResponse.json({ ok: true }); }
