import { NextResponse } from 'next/server';
import { createActivity, listActivities } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await listActivities();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const created = await createActivity(name);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
