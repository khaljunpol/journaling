import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext, type SheetAuth } from '@/lib/sheetAuth';
import { getSettings, newId, setSetting, tabCache } from '@journaling/sheets/googleSheets';
import { withLock } from '@journaling/sheets/keyedLock';
import { makeSecret, hashSecret, encodeCode, parseKey, keyLooksValid, parseDeviceKeys, MAX_DEVICE_KEYS, type StoredKey } from '@/lib/deviceKey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_NAME = 40;

/** Every reply here, errors too, must never be kept by a cache. */
function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/**
 * Runs one read-modify-write of the list at a time on this instance.
 * Not the sheet's `:Settings` lock: setSetting takes that one and withLock is not reentrant, so it would hang.
 */
function withKeysLock<T>(sheetAuth: SheetAuth, fn: () => Promise<T>): Promise<T> {
  return withLock(`${sheetAuth.spreadsheetId}:deviceKeys`, fn);
}

/** The list on a fresh read: the 30 s cache is per server instance, and writing back a stale list would lose a key. */
async function freshKeys(sheetAuth: SheetAuth): Promise<StoredKey[]> {
  tabCache.invalidate(sheetAuth.spreadsheetId, 'settings');
  return parseDeviceKeys((await getSettings(sheetAuth)).deviceKeys);
}

/** Connected devices. Hashes never leave the server. */
export async function GET() {
  try {
    // Session only, and requireSheetContext checks the sheet's ownerEmail.
    const ctx = await requireSheetContext();
    if ('status' in ctx) return noStore(ctx);
    const keys = await freshKeys(ctx.sheetAuth);
    return noStore(NextResponse.json({ keys: keys.map(({ id, name, createdAt }) => ({ id, name, createdAt })) }));
  } catch (error: unknown) {
    return noStore(apiFailure(error, 'GET /api/device/keys'));
  }
}

/** Add a device. The code is returned once; only the hash is stored. */
export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return noStore(ctx);
    const body: unknown = await req.json().catch(() => null);
    const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).name : undefined;
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name || name.length > MAX_NAME) return noStore(apiError(`Name must be 1 to ${MAX_NAME} characters.`, 400));

    const secret = makeSecret();
    const key = `${ctx.sheetAuth.spreadsheetId}.${secret}`;
    // The device door refuses ids of the wrong shape, so a key for one would never work: store nothing.
    const parsed = parseKey(key);
    if (!parsed || !keyLooksValid(parsed)) return noStore(apiError('This sheet id cannot be used for a device.', 400));

    const id = newId();
    const added: StoredKey = { id, name, hash: hashSecret(secret), createdAt: new Date().toISOString() };
    const stored = await withKeysLock(ctx.sheetAuth, async () => {
      const keys = await freshKeys(ctx.sheetAuth);
      if (keys.length >= MAX_DEVICE_KEYS) return false;
      await setSetting(ctx.sheetAuth, 'deviceKeys', JSON.stringify([...keys, added]));
      return true;
    });
    if (!stored) return noStore(apiError('Turn off a device first.', 400));
    const url = new URL(req.url).origin;
    return noStore(NextResponse.json({ id, name, code: encodeCode(url, key) }));
  } catch (error: unknown) {
    return noStore(apiFailure(error, 'POST /api/device/keys'));
  }
}

/** Turn one device off. An unknown id is fine: the device is already off. */
export async function DELETE(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return noStore(ctx);
    const id = new URL(req.url).searchParams.get('id');
    await withKeysLock(ctx.sheetAuth, async () => {
      const keys = await freshKeys(ctx.sheetAuth);
      const left = keys.filter((k) => k.id !== id);
      if (left.length !== keys.length) await setSetting(ctx.sheetAuth, 'deviceKeys', JSON.stringify(left));
    });
    return noStore(NextResponse.json({ ok: true }));
  } catch (error: unknown) {
    return noStore(apiFailure(error, 'DELETE /api/device/keys'));
  }
}
