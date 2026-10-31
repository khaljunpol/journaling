import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { localTodayISO } from '@journaling/core/date';
import {
  buildTimePrompt,
  getPromptPeriod,
  type PromptPeriod,
} from '@/lib/promptBuilder';
import { requireSheetContext } from '@/lib/sheetAuth';
import { listHourLogs, listTimeCategories } from '@journaling/sheets/googleSheets';

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

    const [categories, entries] = await Promise.all([
      listTimeCategories(ctx.sheetAuth),
      listHourLogs(ctx.sheetAuth, range.fromISO, range.toISO),
    ]);

    const prompt = buildTimePrompt({
      period,
      ...range,
      categories,
      entries,
    });

    return NextResponse.json({ period, ...range, prompt });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/prompts/time');
  }
}
