import { NextResponse } from 'next/server';
import { listTimeCategories, upsertTimeCategory, deleteTimeCategory } from '@/lib/googleSheets';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const items = await listTimeCategories(account);
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
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
