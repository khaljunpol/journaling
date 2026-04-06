import { NextRequest, NextResponse } from 'next/server';
import { deleteActivity, updateActivity } from '@/lib/googleSheets';
import { apiError, getErrorMessage, MAX_LEN } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await context.params;
    const body = await req.json();
    const name = body?.name !== undefined ? String(body?.name || '').trim() : undefined;
    const status = body?.status !== undefined ? (String(body?.status || '').trim() as 'active' | 'stopped') : undefined;
    if (name === undefined && status === undefined) return apiError('no fields to update', 400);
    if (name !== undefined && name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    const updated = await updateActivity(ctx.sheetAuth, ctx.account, id, { name, status });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('[PATCH /api/activities/[id]]', getErrorMessage(error));
    return apiError(getErrorMessage(error) || 'Unknown error', 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await context.params;
    await deleteActivity(ctx.sheetAuth, ctx.account, id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[DELETE /api/activities/[id]]', getErrorMessage(error));
    return apiError(getErrorMessage(error) || 'Unknown error', 500);
  }
}
