import { NextResponse } from 'next/server';
import { createActivity, listActivities } from '@journaling/sheets/googleSheets';
import { apiError, MAX_LEN, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const data = await listActivities(ctx.sheetAuth);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/activities');
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const status = String(body?.status || 'active').trim() as 'active' | 'stopped';
    if (!name) return apiError('name required', 400);
    if (name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    const created = await createActivity(ctx.sheetAuth, name, { status: status === 'stopped' ? 'stopped' : 'active' });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/activities');
  }
}
