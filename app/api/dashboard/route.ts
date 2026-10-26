import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { apiErrorBody } from '@/lib/server/apiError';
import { requireSheetContext } from '@/lib/sheetAuth';
import { localISO, weekStartLocal } from '@/lib/date';
import {
  listActivities,
  getLogsBetween,
  getWeightsBetween,
  getHighlightsBetween,
  getMoodsBetween,
  getConsistencyMetrics,
  listTimeCategories,
  listHourLogs,
  listClimbLogs,
  listClimbGoals,
} from '@/lib/googleSheets';
import { listSidequests } from '@/lib/sidequests';

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { sheetAuth } = ctx;

    const today = new Date();
    const todayISO = localISO(today);
    const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
    const from7ISO = localISO(d7);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
    const from30ISO = localISO(d30);
    const ws = weekStartLocal(today);
    const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
    const prevWs = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7);
    const prevWe = new Date(prevWs.getFullYear(), prevWs.getMonth(), prevWs.getDate() + 6);
    const weekFromISO = localISO(ws);
    const weekToISO = localISO(we);
    const prevWeekFromISO = localISO(prevWs);
    const prevWeekToISO = localISO(prevWe);
    const y = today.getFullYear();
    const yStartISO = `${y}-01-01`;
    const yEndISO = `${y}-12-31`;
    const eightWeeksAgo = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * 8);
    const eightWeeksAgoISO = localISO(eightWeeksAgo);
    const twelveWeeksAgo = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * 12);
    const twelveWeeksAgoISO = localISO(twelveWeeksAgo);

    const safe = <T>(p: Promise<T>, fallback: T): Promise<T> =>
      p.catch((err) => { apiErrorBody(err, 'GET /api/dashboard (partial)'); return fallback; });

    const [activities, logs30, weights8w, highlights30] = await Promise.all([
      safe(listActivities(sheetAuth), []),
      safe(getLogsBetween(sheetAuth, from30ISO, todayISO), []),
      safe(getWeightsBetween(sheetAuth, eightWeeksAgoISO, todayISO), []),
      safe(getHighlightsBetween(sheetAuth, from30ISO, todayISO), []),
    ]);

    const [moods7, moodsPrev7, metrics, timeCategories, timeY, climb30, goals, climbY, sidequests] = await Promise.all([
      safe(getMoodsBetween(sheetAuth, from7ISO, todayISO), []),
      safe(getMoodsBetween(sheetAuth, prevWeekFromISO, prevWeekToISO), []),
      safe(getConsistencyMetrics(sheetAuth), null),
      safe(listTimeCategories(sheetAuth), []),
      safe(listHourLogs(sheetAuth, yStartISO, yEndISO), []),
      safe(listClimbLogs(sheetAuth, from30ISO, todayISO), []),
      safe(listClimbGoals(sheetAuth), []),
      safe(listClimbLogs(sheetAuth, yStartISO, yEndISO), []),
      safe(listSidequests(sheetAuth, y), []),
    ]);

    return NextResponse.json({
      dates: { todayISO, from7ISO, from30ISO, weekFromISO, weekToISO, prevWeekFromISO, prevWeekToISO, yStartISO, yEndISO, eightWeeksAgoISO, twelveWeeksAgoISO },
      activities: Array.isArray(activities) ? activities : [],
      logs30: Array.isArray(logs30) ? logs30 : [],
      weights8w: Array.isArray(weights8w) ? weights8w : [],
      highlights30: Array.isArray(highlights30) ? highlights30 : [],
      moods7: Array.isArray(moods7) ? moods7 : [],
      metrics: metrics || null,
      timeCategories: Array.isArray(timeCategories) ? timeCategories : [],
      timeY: Array.isArray(timeY) ? timeY : [],
      climb30: Array.isArray(climb30) ? climb30 : [],
      goals: Array.isArray(goals) ? goals : [],
      climbY: Array.isArray(climbY) ? climbY : [],
      moodsPrev7: Array.isArray(moodsPrev7) ? moodsPrev7 : [],
      sidequests: Array.isArray(sidequests) ? sidequests : [],
    });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/dashboard');
  }
}
