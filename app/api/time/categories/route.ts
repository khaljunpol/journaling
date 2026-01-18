import { NextResponse } from 'next/server';
import { listTimeCategories, upsertTimeCategory, deleteTimeCategory } from '@/lib/googleSheets';

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
    const account = url.searchParams.get('account') || 'Alex';
    const key = keyFor(account);
    const cached = getCached(key);
    if (cached) return NextResponse.json(cached);
    const items = await listTimeCategories(account);
    setCached(key, items);
    return NextResponse.json(items);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const color = String(body?.color || '').trim();
    const id = body?.id ? String(body.id) : undefined;
    const order = body?.order !== undefined ? Number(body.order) : undefined;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const saved = await upsertTimeCategory(account, { id, name, color, order });
    invalidateAll();
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const res = await deleteTimeCategory(account, id);
    invalidateAll();
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
