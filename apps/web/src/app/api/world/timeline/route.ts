import { NextResponse } from 'next/server';
import { apiFailure } from '@/lib/apiHelpers';
import { appDay } from '@journaling/core/timeZone';
import { loadTimeline } from '@/lib/server/game';
import { requireSheetContext } from '@/lib/sheetAuth';

/** When each thing in the Valley appeared, for "Watch your year". Dates, counts and weekly hours only. Read-only. */
export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const timeline = await loadTimeline(ctx.sheetAuth, appDay(new Date()));
    return NextResponse.json(timeline, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/world/timeline');
  }
}
