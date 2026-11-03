import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { appDateISO } from '@/lib/reminder';
import { insightInputFrom } from '@/lib/server/insightInput';
import { requireSheetContext } from '@/lib/sheetAuth';
import { dayPoints } from '@journaling/core/game';
import { parseScoreRows } from '@journaling/core/ledger';
import { yearDays, yearSummary } from '@journaling/core/yearDays';
import { gameSettings } from '@/lib/server/gameInput';
import {
  getLogsBetween, getMoodsBetween, getSettings, listActivities, listDayScores, listDayStamps, listFillMarks, listHourLogs, listTimeCategories, tabCache,
} from '@journaling/sheets/googleSheets';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** The year calendar: per day [mood, habitShare, sleepHours, points, perfect], plus the header numbers. Read-only: never locks. */
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
    await tabCache.read(sheetAuth.spreadsheetId, ['activities', 'logs', 'moods', 'timeCategories', 'hours', 'settings', 'dayLogs']);
    const [moods, hours, logs, activities, cats, settings, stamps, fills] = await Promise.all([
      getMoodsBetween(sheetAuth, from, to),
      listHourLogs(sheetAuth, from, to),
      getLogsBetween(sheetAuth, from, to),
      listActivities(sheetAuth),
      listTimeCategories(sheetAuth),
      getSettings(sheetAuth),
      listDayStamps(sheetAuth),
      listFillMarks(sheetAuth),
    ]);
    const input = insightInputFrom({ moods, hours, logs, activities, cats }, today);
    const g = gameSettings(settings);
    const locked = g.imported ? parseScoreRows(await listDayScores(sheetAuth)) : new Map();
    const points = dayPoints({ today, logs: input.logs, activities: input.activities, templates: g.templates, stamps, fills, locked, lockedTo: g.imported ? g.lockedTo : null }, `${year}-01-01`, to);
    const days = yearDays(year, input, points);
    return NextResponse.json({ year, days, summary: yearSummary(days) }, { headers: NO_STORE });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/year');
  }
}
