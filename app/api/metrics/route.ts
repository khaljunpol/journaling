import { NextResponse } from 'next/server';
import { getConsistencyMetrics } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getConsistencyMetrics();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
