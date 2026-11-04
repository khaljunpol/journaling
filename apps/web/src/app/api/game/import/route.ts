import { NextResponse } from 'next/server';
import { apiFailure } from '@/lib/apiHelpers';
import { appDay } from '@journaling/core/timeZone';
import { loadGame } from '@/lib/server/game';
import { requireSheetContext } from '@/lib/sheetAuth';

/** "Count my history": locks every closed day from the first logged day. Safe to repeat: the first row per date wins. */
export async function POST() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const state = await loadGame(ctx.sheetAuth, appDay(new Date()), 'import');
    return NextResponse.json(state, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/game/import');
  }
}
