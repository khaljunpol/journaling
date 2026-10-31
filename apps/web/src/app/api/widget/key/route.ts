import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { setSetting } from '@journaling/sheets/googleSheets';
import { makeSecret, hashSecret, encodeCode, parseKey, keyLooksValid } from '@/lib/widgetKey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Make a new widget key (replaces any old one). The code is returned once; only the hash is stored. */
export async function POST(req: Request) {
  try {
    // Session only, and requireSheetContext checks the sheet's ownerEmail.
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const secret = makeSecret();
    const key = `${ctx.sheetAuth.spreadsheetId}.${secret}`;
    // The widget refuses ids of the wrong shape, so a key for one would never work: store nothing.
    const parsed = parseKey(key);
    if (!parsed || !keyLooksValid(parsed)) return apiError('This sheet id cannot be used for the widget.', 400);
    await setSetting(ctx.sheetAuth, 'widgetKeyHash', hashSecret(secret));
    const url = new URL(req.url).origin;
    return NextResponse.json({ code: encodeCode(url, key) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/widget/key');
  }
}

/** Turn the widget off: the stored hash is cleared, so every key is refused. */
export async function DELETE() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    await setSetting(ctx.sheetAuth, 'widgetKeyHash', '');
    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/widget/key');
  }
}
