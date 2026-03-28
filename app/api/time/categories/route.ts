import { NextResponse } from 'next/server';
import { listTimeCategories, upsertTimeCategory, deleteTimeCategory } from '@/lib/googleSheets';
import { apiError, getAccountParam, getErrorMessage, MAX_LEN } from '@/lib/apiHelpers';
import { createApiCache } from '@/lib/apiCache';

const cache = createApiCache(120_000);
const keyFor = (account: string) => `timeCats:${account}`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const key = keyFor(account);
    const cached = cache.get(key);
    if (cached) return NextResponse.json(cached);
    const items = await listTimeCategories(account);
    cache.set(key, items);
    return NextResponse.json(items);
  } catch (error: unknown) {
    console.error('[GET /api/time/categories]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const color = String(body?.color || '').trim();
    const id = body?.id ? String(body.id) : undefined;
    const order = body?.order !== undefined ? Number(body.order) : undefined;
    if (!name) return apiError('name required', 400);
    if (name.length > MAX_LEN.name) return apiError(`name must be ≤${MAX_LEN.name} characters`, 400);
    if (color.length > MAX_LEN.color) return apiError(`color must be ≤${MAX_LEN.color} characters`, 400);
    const saved = await upsertTimeCategory(account, { id, name, color, order });
    cache.invalidate();
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/time/categories]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return apiError('id required', 400);
    const res = await deleteTimeCategory(account, id);
    cache.invalidate();
    return NextResponse.json(res);
  } catch (error: unknown) {
    console.error('[DELETE /api/time/categories]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
