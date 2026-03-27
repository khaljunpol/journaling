import { NextResponse } from 'next/server';
import { createActivity, listActivities } from '@/lib/googleSheets';
import { apiError, getAccountParam, MAX_LEN } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const data = await listActivities(account);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[GET /api/activities]', e);
    return apiError('Failed to fetch activities', 503);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const status = String(body?.status || 'active').trim() as 'active' | 'stopped';
    if (!name) return apiError('name required', 400);
    if (name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const created = await createActivity(account, name, { status: status === 'stopped' ? 'stopped' : 'active' });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/activities]', e);
    const msg = String(e?.message || '');
    if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
      return apiError('Google Sheets not configured', 503);
    }
    return apiError(msg || 'Unknown error', 500);
  }
}
