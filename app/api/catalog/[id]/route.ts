import { NextRequest, NextResponse } from 'next/server';
import { deleteCatalogItem, updateCatalogItem } from '@/lib/googleSheets';
import { apiError, MAX_LEN } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const name = body?.name as string | undefined;
    const category = body?.category as string | undefined;
    const tags = body?.tags as string | undefined;
    if (name !== undefined && name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    if (category !== undefined && category.length > MAX_LEN.category) return apiError(`category must be ≤${MAX_LEN.category} characters`, 400);
    if (tags !== undefined && tags.length > MAX_LEN.tags) return apiError(`tags must be ≤${MAX_LEN.tags} characters`, 400);
    const updated = await updateCatalogItem(id, { name, category, tags });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('[PATCH /api/catalog/[id]]', e);
    return apiError(e.message || 'Unknown error', 500);
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteCatalogItem(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[DELETE /api/catalog/[id]]', e);
    return apiError(e.message || 'Unknown error', 500);
  }
}

export async function OPTIONS() { return NextResponse.json({ ok: true }); }
export async function HEAD() { return NextResponse.json({ ok: true }); }
