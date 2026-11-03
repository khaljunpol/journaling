import { NextResponse } from 'next/server';
import { listTimeCategories, upsertTimeCategory, deleteTimeCategory } from '@journaling/sheets/googleSheets';
import { apiError, MAX_LEN, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { parseGroup } from '@journaling/core/timeBalance';

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const items = await listTimeCategories(ctx.sheetAuth);
    return NextResponse.json(items);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/time/categories');
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const color = String(body?.color || '').trim();
    const id = body?.id ? String(body.id) : undefined;
    const order = body?.order !== undefined ? Number(body.order) : undefined;
    // group: missing keeps the saved one, '' clears it, else it must be a known group.
    const group = body?.group === undefined ? undefined : body.group === '' ? '' : parseGroup(body.group);
    if (group === undefined && body?.group !== undefined) return apiError('group must be sleep, work, people, rest, body, mind, admin or none', 400);
    if (!name) return apiError('name required', 400);
    if (name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    if (color.length > MAX_LEN.color) return apiError(`color must be ≤${MAX_LEN.color} characters`, 400);
    const saved = await upsertTimeCategory(ctx.sheetAuth, { id, name, color, order, group });
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/time/categories');
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return apiError('id required', 400);
    const res = await deleteTimeCategory(ctx.sheetAuth, id);
    return NextResponse.json(res);
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/time/categories');
  }
}
