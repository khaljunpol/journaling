import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { loadQuickPayload } from '@/lib/server/loadQuick';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 14;

function dayNumber(iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t).toISOString().slice(0, 10);
  return back === iso ? t / 86400000 : null;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { sheetAuth } = ctx;

    const params = new URL(req.url).searchParams;
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    const a = ISO.test(from) ? dayNumber(from) : null;
    const b = ISO.test(to) ? dayNumber(to) : null;
    if (a === null || b === null) return apiError('from and to must be YYYY-MM-DD', 400);
    if (a > b) return apiError('from must be on or before to', 400);
    if (b - a + 1 > MAX_DAYS) return apiError(`range is at most ${MAX_DAYS} days`, 400);

    const { payload } = await loadQuickPayload(sheetAuth, from, to);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/quick');
  }
}
