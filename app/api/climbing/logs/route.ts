import { NextResponse } from 'next/server';
import { listClimbLogs, addClimbLog, deleteClimbLog } from '@/lib/googleSheets';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limitParam = url.searchParams.get('limit');
    const pageParam = url.searchParams.get('page');
    if (from && to) {
      const items = await listClimbLogs(account, from, to);
      return NextResponse.json(items);
    }
    if (date) {
      const items = await listClimbLogs(account, date, date);
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
        if (bd !== ad) return bd - ad; // newest first
        if (b.session !== a.session) return (b.session || 0) - (a.session || 0);
        return String(b.id).localeCompare(String(a.id));
      });
      const total = sorted.length;
      const offset = (page - 1) * limit;
      const slice = sorted.slice(offset, offset + limit);
      return NextResponse.json({ items: slice, total, page, limit });
    }
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
    const session = parseInt(String(body?.session ?? '0'), 10) || 0;
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const attempts = parseInt(String(body?.attempts ?? '0'), 10) || 0;
    const location = String(body?.location || '').trim();
    const notes = String(body?.notes || '').trim();
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
    const saved = await addClimbLog(account, { date, session, type, grade, attempts, location, notes });
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
    const out = await deleteClimbLog(account, id);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
