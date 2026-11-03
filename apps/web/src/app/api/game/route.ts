import { NextResponse } from 'next/server';
import { apiFailure } from '@/lib/apiHelpers';
import { appDateISO } from '@/lib/reminder';
import { loadGame } from '@/lib/server/game';
import { requireSheetContext } from '@/lib/sheetAuth';

/** Points, level, streaks and badges. Before the history import this is a preview and writes nothing. */
export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const state = await loadGame(ctx.sheetAuth, appDateISO(new Date()), 'read');
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/game');
  }
}
