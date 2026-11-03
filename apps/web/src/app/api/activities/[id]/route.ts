import { NextRequest, NextResponse } from 'next/server';
import { parseCategory } from '@journaling/core/habitCategory';
import { deleteActivity, updateActivity } from '@journaling/sheets/googleSheets';
import { apiError, MAX_LEN, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await context.params;
    const body = await req.json();
    const name = body?.name !== undefined ? String(body?.name || '').trim() : undefined;
    const status = body?.status !== undefined ? (String(body?.status || '').trim() as 'active' | 'stopped') : undefined;
    const category = body?.category !== undefined ? parseCategory(body.category) : undefined;
    if (body?.category !== undefined && !category) return apiError('unknown category', 400);
    if (name === undefined && status === undefined && category === undefined) return apiError('no fields to update', 400);
    if (name !== undefined && name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    const updated = await updateActivity(ctx.sheetAuth, id, { name, status, category });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiFailure(error, 'PATCH /api/activities/[id]');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await context.params;
    await deleteActivity(ctx.sheetAuth, id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/activities/[id]');
  }
}
