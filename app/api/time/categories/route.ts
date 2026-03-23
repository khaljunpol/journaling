import { NextResponse } from 'next/server';
import { listTimeCategories, upsertTimeCategory, deleteTimeCategory } from '@/lib/googleSheets';
import { apiError, getAccountParam, MAX_LEN } from '@/lib/apiHelpers';

// Short TTL in-memory cache to reduce repeated Sheets reads
const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 120 * 1000; // 120 seconds (categories change rarely)
const now = () => Date.now();
const keyFor = (account: string) => `timeCats:${account}`;
const getCached = (key: string) => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now() - hit.ts > TTL_MS) { cache.delete(key); return undefined; }
  return hit.data;
};
const setCached = (key: string, data: any) => { cache.set(key, { ts: now(), data }); };
const invalidateAll = () => { cache.clear(); };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const key = keyFor(account);
    const cached = getCached(key);
    if (cached) return NextResponse.json(cached);
    const items = await listTimeCategories(account);
    setCached(key, items);
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[GET /api/time/categories]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
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
    invalidateAll();
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/time/categories]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
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
    invalidateAll();
    return NextResponse.json(res);
  } catch (e: any) {
    console.error('[DELETE /api/time/categories]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
  }
}
