import {
  listActivities,
  getLogsBetween,
  getMoodsBetween,
  getWeightsBetween,
  getHighlightsBetween,
  listHourLogs,
  listClimbLogs,
  listTimeCategories,
  getSettings,
  tabCache,
  type SheetAuth,
} from '@/lib/googleSheets';
import { listSidequests, listSidequestLogs } from '@/lib/sidequests';
import { buildQuickPayload, type QuickPayload } from '@/lib/quickPayload';

/** Read a date range from one sheet and build the board payload. Shared by /api/quick and the reminder. */
export async function loadQuickPayload(sheetAuth: SheetAuth, from: string, to: string): Promise<{
  payload: QuickPayload;
  settings: Record<string, string>;
}> {
  // One batched read fills the cache; the calls below hit memory.
  await tabCache.read(sheetAuth.spreadsheetId, [
    'activities', 'logs', 'moods', 'weights', 'highlights', 'hours', 'climbs',
    'sidequests', 'sidequestLogs', 'timeCategories', 'settings',
  ]);

  const [activities, logs, moods, weights, highlights, hours, climbs, sidequests, sidequestLogs, categories, settings] =
    await Promise.all([
      listActivities(sheetAuth),
      getLogsBetween(sheetAuth, from, to),
      getMoodsBetween(sheetAuth, from, to),
      getWeightsBetween(sheetAuth, from, to),
      getHighlightsBetween(sheetAuth, from, to),
      listHourLogs(sheetAuth, from, to),
      listClimbLogs(sheetAuth, from, to),
      listSidequests(sheetAuth),
      listSidequestLogs(sheetAuth),
      listTimeCategories(sheetAuth),
      getSettings(sheetAuth),
    ]);

  const payload = buildQuickPayload(
    { activities, logs, moods, weights, highlights, hours, climbs, sidequests, sidequestLogs, categories },
    from,
    to,
    settings,
  );
  return { payload, settings };
}
