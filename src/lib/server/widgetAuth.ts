import { getSettings, type SheetAuth } from '@/lib/googleSheets';
import { allowedEmails } from '@/lib/auth';
import { parseKey, decideWidgetKey, keyLooksValid, makeReadGate } from '@/lib/widgetKey';

// A real key is ~90 chars (sheet id + 43-char secret). Anything far longer is junk.
const MAX_HEADER = 512;

// Per server instance: sheets that passed once read freely; unknown sheets share 10 reads a minute.
const readGate = makeReadGate({ limit: 10, windowMs: 60_000, now: Date.now });

/** Read the Bearer key. Null for a missing or malformed header. */
function bearerKey(header: string | null): string | null {
  if (!header || header.length > MAX_HEADER) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

async function check(req: Request): Promise<{ sheetAuth: SheetAuth } | null> {
  const key = bearerKey(req.headers.get('authorization'));
  const parsed = key ? parseKey(key) : null;
  // Shape and read budget first: junk keys never cost a sheet read.
  if (!parsed || !keyLooksValid(parsed)) return null;
  if (!readGate.allow(parsed.spreadsheetId)) return null;
  const sheetAuth: SheetAuth = { spreadsheetId: parsed.spreadsheetId };
  let settings: Record<string, string>;
  try {
    settings = await getSettings(sheetAuth);
  } catch {
    return null;
  }
  if (!decideWidgetKey(settings, parsed.secret, allowedEmails)) return null;
  readGate.trust(parsed.spreadsheetId);
  return { sheetAuth };
}

/**
 * Widget key check: `Authorization: Bearer <spreadsheetId>.<secret>`.
 * Passes only when that sheet stores a matching widgetKeyHash and its owner is still allowed.
 * Any failure, including a sheet that cannot be read or the read cap, is null. Never logs the key or the sheet id.
 */
export async function authWidget(req: Request): Promise<{ sheetAuth: SheetAuth } | null> {
  const result = await check(req);
  if (!result) console.warn('[widget] key refused');
  return result;
}
