import { NextResponse } from 'next/server';
import { getConsistencyMetrics } from '@/lib/googleSheets';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const data = await getConsistencyMetrics(account);
    return NextResponse.json(data);
  } catch (e: any) {
    // Fallback to empty metrics for setup phase
    return NextResponse.json({ weeks: [], byActivity: [], summary: { avgRate: 0, bestWeek: null, currentStreakDays: 0, totalCompletions: 0 } }, { status: 200 });
  }
}
