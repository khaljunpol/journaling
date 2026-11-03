import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { appDateISO } from '@/lib/reminder';
import { insightInputFrom } from '@/lib/server/insightInput';
import { requireSheetContext } from '@/lib/sheetAuth';
import { yearDays, yearSummary } from '@journaling/core/yearDays';
import { getLogsBetween, getMoodsBetween, listActivities, listHourLogs, listTimeCategories, tabCache } from '@journaling/sheets/googleSheets';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** The year calendar: per day [mood, habitShare, sleepHours, points], plus the header numbers. Read-only. */
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get('year') ?? '';
    const year = /^\d{4}$/.test(raw) ? Number(raw) : NaN;
    if (!(year >= 2000 && year <= 2100)) return apiError('year must be YYYY', 400);
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { sheetAuth } = ctx;
    const today = appDateISO(new Date());
    // From 31 Dec of the year before: the night ending on 1 Jan starts that evening.
    const from = `${year - 1}-12-31`;
    const to = `${year}-12-31`;
    await tabCache.read(sheetAuth.spreadsheetId, ['activities', 'logs', 'moods', 'timeCategories', 'hours']);
    const [moods, hours, logs, activities, cats] = await Promise.all([
      getMoodsBetween(sheetAuth, from, to),
      listHourLogs(sheetAuth, from, to),
      getLogsBetween(sheetAuth, from, to),
      listActivities(sheetAuth),
      listTimeCategories(sheetAuth),
    ]);
    const days = yearDays(year, insightInputFrom({ moods, hours, logs, activities, cats }, today));
    return NextResponse.json({ year, days, summary: yearSummary(days) }, { headers: NO_STORE });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/year');
  }
}
