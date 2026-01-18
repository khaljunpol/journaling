import { NextResponse } from 'next/server';
import { listHourLogs, upsertHourLog, upsertHourLogsBatch } from '@/lib/googleSheets';

// Simple in-memory cache with short TTL for GETs to reduce Sheets reads
const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 60 * 1000; // 60 seconds
const now = () => Date.now();
const getKey = (account: string, date?: string | null, from?: string | null, to?: string | null) => {
  const scope = from && to ? `range:${from}-${to}` : (date ? `date:${date}` : 'all');
  return `hours:${account}|${scope}`;
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
    const account = url.searchParams.get('account') || 'Alex';
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const key = getKey(account, date, from, to);
    const cached = getCached(key);
    if (cached) return NextResponse.json(cached);
    if (date) {
      const items = await listHourLogs(account, date, date);
      setCached(key, items);
      return NextResponse.json(items);
    }
    if (from && to) {
      const items = await listHourLogs(account, from, to);
      setCached(key, items);
      return NextResponse.json(items);
    }
    const items = await listHourLogs(account);
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
    const date = String(body?.date || '').slice(0,10);
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    // Batch mode: entries array provided
    if (Array.isArray(body?.entries)) {
      const entries = (body.entries as Array<any>).map((e) => ({
        hour: parseInt(String(e?.hour ?? '-1'), 10),
        category: parseInt(String(e?.category ?? '-1'), 10),
      }));
      for (const e of entries) {
        if (!Number.isFinite(e.hour) || e.hour < 0 || e.hour > 23) return NextResponse.json({ error: 'hour must be 0..23' }, { status: 400 });
        if (!Number.isFinite(e.category) || e.category < 0 || e.category > 11) return NextResponse.json({ error: 'category must be 0..11' }, { status: 400 });
      }
      const saved = await upsertHourLogsBatch(account, { date, entries });
      invalidateAll();
      return NextResponse.json(saved, { status: 201 });
    }

    // Single entry fallback
    let hour = parseInt(String(body?.hour ?? '-1'), 10);
    let category = parseInt(String(body?.category ?? '-1'), 10);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return NextResponse.json({ error: 'hour must be 0..23' }, { status: 400 });
    if (!Number.isFinite(category) || category < 0 || category > 11) return NextResponse.json({ error: 'category must be 0..11' }, { status: 400 });
    const saved = await upsertHourLog(account, { date, hour, category });
    invalidateAll();
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
