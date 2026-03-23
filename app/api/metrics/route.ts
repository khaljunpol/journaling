import { NextResponse } from 'next/server';
import { getConsistencyMetrics } from '@/lib/googleSheets';
import { apiError, getAccountParam } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const data = await getConsistencyMetrics(account);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[GET /api/metrics]', e);
    return apiError('Failed to fetch metrics', 503);
  }
}
