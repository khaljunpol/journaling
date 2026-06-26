import { NextResponse } from 'next/server';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { localTodayISO } from '@/lib/date';
import {
  buildJournalPrompt,
  getPromptPeriod,
  type PromptPeriod,
} from '@/lib/promptBuilder';
import { requireSheetContext } from '@/lib/sheetAuth';
import {
  getHighlightsBetween,
  getLogsBetween,
  getMoodsBetween,
  getWeightsBetween,
  listActivities,
} from '@/lib/googleSheets';

function parsePeriod(value: string | null): PromptPeriod {
  return value === 'month' ? 'month' : 'week';
}

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;

    const url = new URL(req.url);
    const period = parsePeriod(url.searchParams.get('period'));
    const anchor = String(url.searchParams.get('anchor') || localTodayISO()).slice(0, 10);
    const range = getPromptPeriod(anchor, period);

    const [activities, logs, moods, highlights, weights] = await Promise.all([
      listActivities(ctx.sheetAuth, ctx.account),
      getLogsBetween(ctx.sheetAuth, ctx.account, range.fromISO, range.toISO),
      getMoodsBetween(ctx.sheetAuth, ctx.account, range.fromISO, range.toISO),
      getHighlightsBetween(ctx.sheetAuth, ctx.account, range.fromISO, range.toISO),
      getWeightsBetween(ctx.sheetAuth, ctx.account, range.fromISO, range.toISO),
    ]);

    const prompt = buildJournalPrompt({
      period,
      ...range,
      activities,
      logs,
      moods,
      highlights: highlights.map((h) => ({ date: h.date, highlight: h.text })),
      weights,
    });

    return NextResponse.json({ period, ...range, prompt });
  } catch (error: unknown) {
    console.error('[GET /api/prompts/journal]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
