import { NextResponse } from 'next/server';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { localTodayISO } from '@/lib/date';
import {
  buildTimePrompt,
  getPromptPeriod,
  type PromptPeriod,
} from '@/lib/promptBuilder';
import { requireSheetContext } from '@/lib/sheetAuth';
import { listHourLogs, listTimeCategories } from '@/lib/googleSheets';

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
      listTimeCategories(ctx.sheetAuth, ctx.account),
      listHourLogs(ctx.sheetAuth, ctx.account, range.fromISO, range.toISO),
    ]);

    const prompt = buildTimePrompt({
      period,
      ...range,
      categories,
      entries,
    });

    return NextResponse.json({ period, ...range, prompt });
  } catch (error: unknown) {
    console.error('[GET /api/prompts/time]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
