import { NextRequest, NextResponse } from 'next/server';
import { deleteActivity, updateActivity } from '@/lib/googleSheets';
import { apiError, getAccountParam, MAX_LEN } from '@/lib/apiHelpers';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const name = body?.name !== undefined ? String(body?.name || '').trim() : undefined;
    const status = body?.status !== undefined ? (String(body?.status || '').trim() as 'active' | 'stopped') : undefined;
    if (name === undefined && status === undefined) {
      return apiError('no fields to update', 400);
    }
    if (name !== undefined && name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    const account = getAccountParam(req.nextUrl);
    if (!account) return apiError('Invalid account', 400);
    const updated = await updateActivity(account, id, { name, status });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('[PATCH /api/activities/[id]]', e);
    return apiError(e.message || 'Unknown error', 500);
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const account = getAccountParam(_req.nextUrl);
    if (!account) return apiError('Invalid account', 400);
    await deleteActivity(account, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[DELETE /api/activities/[id]]', e);
    return apiError(e.message || 'Unknown error', 500);
  }
}
