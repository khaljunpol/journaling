import { NextResponse } from 'next/server';
import { listClimbGoals, upsertClimbGoal, deleteClimbGoal } from '@/lib/googleSheets';
import { apiError, getAccountParam, MAX_LEN } from '@/lib/apiHelpers';

// Simple in-memory cache per process with short TTL to reduce Sheets reads
const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 60 * 1000; // 60 seconds
const now = () => Date.now();
const getKey = (account: string) => `goals:${account}`;
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
    const key = getKey(account);
    const cached = getCached(key);
    if (cached) return NextResponse.json(cached);
    const items = await listClimbGoals(account);
    setCached(key, items);
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[GET /api/climbing/goals]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const body = await req.json();
    const year = parseInt(String(body?.year ?? new Date().getFullYear()), 10);
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const target = parseInt(String(body?.target ?? '0'), 10) || 0;
    if (!grade || !target) return apiError('grade and target required', 400);
    if (grade.length > MAX_LEN.grade) return apiError(`grade must be ≤${MAX_LEN.grade} characters`, 400);
    const saved = await upsertClimbGoal(account, { year, type, grade, target });
    invalidateAll();
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    console.error('[POST /api/climbing/goals]', e);
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
    const out = await deleteClimbGoal(account, id);
    invalidateAll();
    return NextResponse.json(out);
  } catch (e: any) {
    console.error('[DELETE /api/climbing/goals]', e);
    return apiError(String(e?.message || 'Unknown error'), 500);
  }
}
