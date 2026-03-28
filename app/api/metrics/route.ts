import { NextResponse } from 'next/server';
import { getConsistencyMetrics } from '@/lib/googleSheets';
import { apiError, getAccountParam, getErrorMessage } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const data = await getConsistencyMetrics(account);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[GET /api/metrics]', getErrorMessage(error));
    return apiError('Failed to fetch metrics', 503);
  }
}
