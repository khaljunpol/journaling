import { NextResponse } from 'next/server';
import { listClimbLogs, addClimbLog, deleteClimbLog } from '@/lib/googleSheets';
import { apiError, getAccountParam, MAX_LEN } from '@/lib/apiHelpers';

// Simple in-memory cache with short TTL for GETs to reduce Sheets reads
const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 60 * 1000; // 60 seconds
const now = () => Date.now();
const getKey = (account: string, date?: string | null, from?: string | null, to?: string | null, paged?: string | null) => {
  const scope = from && to ? `range:${from}-${to}` : (date ? `date:${date}` : 'all');
  const pg = paged ? `|p:${paged}` : '';
  return `climbLogs:${account}|${scope}${pg}`;
};
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
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limitParam = url.searchParams.get('limit');
    const pageParam = url.searchParams.get('page');
    const key = getKey(account, date, from, to, limitParam ? `${limitParam}:${pageParam || '1'}` : null);
    const cached = getCached(key);
    if (cached) return NextResponse.json(cached);
    if (from && to) {
      const items = await listClimbLogs(account, from, to);
      setCached(key, items);
      return NextResponse.json(items);
    }
    if (date) {
      const items = await listClimbLogs(account, date, date);
      setCached(key, items);
      return NextResponse.json(items);
    }
    const items = await listClimbLogs(account);
    // Optional pagination
    if (limitParam) {
      const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10));
      const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const sorted = items.slice().sort((a, b) => {
        const ad = new Date(a.date).getTime();
        const bd = new Date(b.date).getTime();
        if (bd !== ad) return bd - ad;
        if (b.session !== a.session) return (b.session || 0) - (a.session || 0);
        return String(b.id).localeCompare(String(a.id));
      });
      const total = sorted.length;
      const offset = (page - 1) * limit;
      const slice = sorted.slice(offset, offset + limit);
      const paged = { items: slice, total, page, limit };
      setCached(key, paged);
      return NextResponse.json(paged);
    }
    setCached(key, items);
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[GET /api/climbing/logs]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const body = await req.json();
    const date = String(body?.date || '').slice(0, 10);
    const session = parseInt(String(body?.session ?? '0'), 10) || 0;
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const attempts = parseInt(String(body?.attempts ?? '0'), 10) || 0;
    const location = String(body?.location || '').trim();
    const notes = String(body?.notes || '').trim();
    if (!date) return apiError('date required', 400);
    if (grade.length > MAX_LEN.grade) return apiError(`grade must be ≤${MAX_LEN.grade} characters`, 400);
    if (location.length > MAX_LEN.location) return apiError(`location must be ≤${MAX_LEN.location} characters`, 400);
    if (notes.length > MAX_LEN.notes) return apiError(`notes must be ≤${MAX_LEN.notes} characters`, 400);
    const saved = await addClimbLog(account, { date, session, type, grade, attempts, location, notes });
    invalidateAll();
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/climbing/logs]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const id = url.searchParams.get('id');
    if (!id) return apiError('id required', 400);
    const out = await deleteClimbLog(account, id);
    invalidateAll();
    return NextResponse.json(out);
  } catch (e: any) {
    console.error('[DELETE /api/climbing/logs]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
  }
}
