import { NextResponse } from 'next/server';
import { listClimbGoals, upsertClimbGoal, deleteClimbGoal } from '@/lib/googleSheets';

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
    const account = url.searchParams.get('account') || 'Alex';
    const key = getKey(account);
    const cached = getCached(key);
    if (cached) return NextResponse.json(cached);
    const items = await listClimbGoals(account);
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
    const year = parseInt(String(body?.year ?? new Date().getFullYear()), 10);
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const target = parseInt(String(body?.target ?? '0'), 10) || 0;
    if (!grade || !target) return NextResponse.json({ error: 'grade and target required' }, { status: 400 });
    const saved = await upsertClimbGoal(account, { year, type, grade, target });
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
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const out = await deleteClimbGoal(account, id);
    invalidateAll();
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
