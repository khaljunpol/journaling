import { NextResponse } from 'next/server';
import { apiFailure } from '@/lib/apiHelpers';
import { appDay } from '@journaling/core/timeZone';
import { loadWorld } from '@/lib/server/game';
import { requireSheetContext } from '@/lib/sheetAuth';

/** The Valley: things, stars and landmarks from earned points. Read-only. */
export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const world = await loadWorld(ctx.sheetAuth, appDay(new Date()));
    return NextResponse.json(world, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/world');
  }
}
