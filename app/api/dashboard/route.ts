import { NextResponse } from 'next/server';
import { apiError, getAccountParam, getErrorMessage } from '@/lib/apiHelpers';
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);

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

    // Call library functions directly — no HTTP round trips, no auth issues
    const safe = <T>(p: Promise<T>, fallback: T): Promise<T> =>
      p.catch((err) => { console.error('[dashboard]', getErrorMessage(err)); return fallback; });

    const [activities, logs30, weights8w, highlights30] = await Promise.all([
      safe(listActivities(account), []),
      safe(getLogsBetween(account, from30ISO, todayISO), []),
      safe(getWeightsBetween(account, eightWeeksAgoISO, todayISO), []),
      safe(getHighlightsBetween(account, from30ISO, todayISO), []),
    ]);

    const [moods7, moodsPrev7, metrics, timeCategories, timeY, climb30, goals, climbY] = await Promise.all([
      safe(getMoodsBetween(account, from7ISO, todayISO), []),
      safe(getMoodsBetween(account, prevWeekFromISO, prevWeekToISO), []),
      safe(getConsistencyMetrics(account), null),
      safe(listTimeCategories(account), []),
      safe(listHourLogs(account, yStartISO, yEndISO), []),
      safe(listClimbLogs(account, from30ISO, todayISO), []),
      safe(listClimbGoals(account), []),
      safe(listClimbLogs(account, yStartISO, yEndISO), []),
    ]);

    return NextResponse.json({
      account,
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
    });
  } catch (error: unknown) {
    console.error('[GET /api/dashboard]', getErrorMessage(error));
    return NextResponse.json({ error: 'Failed to aggregate dashboard data' }, { status: 500 });
  }
}
