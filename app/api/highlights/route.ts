import { NextResponse } from 'next/server';
import { setHighlight } from '@/lib/googleSheets';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = String(body?.date || '');
    const text = String(body?.text || '');
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
    await setHighlight(date, text);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
