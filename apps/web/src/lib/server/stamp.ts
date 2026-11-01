import { stampTime, type StampKind } from '@journaling/core/dayState';
import { stampDay, type SheetAuth } from '@journaling/sheets/googleSheets';

/**
 * Records when a part of a day was first logged. The offline outbox sends the tap time in `x-logged-at`,
 * so a tap that reaches the server late still counts from when it was made.
 */
export function stampFrom(req: Request, sheetAuth: SheetAuth, date: string, kind: StampKind): Promise<void> {
  const raw = req.headers.get('x-logged-at');
  return stampDay(sheetAuth, date, kind, stampTime(raw ? Number(raw) : null, Date.now()));
}
