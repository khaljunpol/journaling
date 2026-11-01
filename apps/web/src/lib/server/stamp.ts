import { stampTime, TRACKING_START, type StampKind } from '@journaling/core/dayState';
import { getLogsForDate, getMood, getWeight, listHourLogs, stampDay, type SheetAuth } from '@journaling/sheets/googleSheets';

/** Did this part of an old day already hold data? Unknown counts as yes: no stamp beats a wrong one. */
async function alreadyLogged(sheetAuth: SheetAuth, date: string, kind: StampKind): Promise<boolean> {
  try {
    if (kind === 'mood') return (await getMood(sheetAuth, date)) !== null;
    if (kind === 'weight') return (await getWeight(sheetAuth, date)) !== null;
    if (kind === 'habits') return (await getLogsForDate(sheetAuth, date)).length > 0;
    return (await listHourLogs(sheetAuth, date, date)).length > 0;
  } catch {
    return true;
  }
}

/**
 * Call before saving; the returned function records when this part of the day was first logged.
 * The offline outbox sends the tap time in `x-logged-at`, so a tap that reaches the server late still counts from when it was made.
 * Before tracking started, only a part that was empty gets a stamp: an edit to an old log says nothing about when it was logged.
 */
export async function prepareStamp(req: Request, sheetAuth: SheetAuth, date: string, kind: StampKind): Promise<() => Promise<void>> {
  if (date < TRACKING_START && (await alreadyLogged(sheetAuth, date, kind))) return async () => {};
  return () => {
    const raw = req.headers.get('x-logged-at');
    return stampDay(sheetAuth, date, kind, stampTime(raw ? Number(raw) : null, Date.now()));
  };
}
