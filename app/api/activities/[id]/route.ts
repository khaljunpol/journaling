import { NextRequest, NextResponse } from 'next/server';
import { deleteActivity, updateActivity } from '@/lib/googleSheets';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const name = body?.name !== undefined ? String(body?.name || '').trim() : undefined;
    const status = body?.status !== undefined ? (String(body?.status || '').trim() as 'active' | 'stopped') : undefined;
    const catalogId = body?.catalogId !== undefined ? String(body?.catalogId || '').trim() : undefined;
    if (name === undefined && status === undefined && catalogId === undefined) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }
    const account = req.nextUrl.searchParams.get('account') || 'Alex';
    const updated = await updateActivity(account, id, { name, status, catalogId });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const account = _req.nextUrl.searchParams.get('account') || 'Alex';
    await deleteActivity(account, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
