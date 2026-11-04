import { NextResponse } from 'next/server';
import { apiFailure } from '@/lib/apiHelpers';
import { appDay } from '@journaling/core/timeZone';
import { insightInputFrom } from '@/lib/server/insightInput';
import { requireSheetContext } from '@/lib/sheetAuth';
import { insights, WINDOW } from '@journaling/core/insights';
import { addDaysISO } from '@journaling/core/quickWeek';
import { getLogsBetween, getMoodsBetween, listActivities, listHourLogs, listTimeCategories, tabCache } from '@journaling/sheets/googleSheets';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** The Insights tab's answers, from the last 180 days (days before tracking started count too). Read-only. */
export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { sheetAuth } = ctx;
    const today = appDay(new Date());
    // One extra day back: the first night in the window needs the evening before.
    const from = addDaysISO(today, -WINDOW);
    await tabCache.read(sheetAuth.spreadsheetId, ['activities', 'logs', 'moods', 'timeCategories', 'hours']);
    const [moods, hours, logs, activities, cats] = await Promise.all([
      getMoodsBetween(sheetAuth, from, today),
      listHourLogs(sheetAuth, from, today),
      getLogsBetween(sheetAuth, from, today),
      listActivities(sheetAuth),
      listTimeCategories(sheetAuth),
    ]);
    return NextResponse.json(insights(insightInputFrom({ moods, hours, logs, activities, cats }, today)), { headers: NO_STORE });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/insights');
  }
}
