import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { demoSheetId, isDemo } from '@/lib/demo';
import { getSessionUserKey } from '@/lib/server/sheetContext';
import {
  clearSheetConnection,
  readSheetConnection,
} from '@/lib/server/sheetConnection';
import { claimOrCheckOwner } from '@/lib/server/sheetOwner';
import { requireSheetContext } from '@/lib/sheetAuth';
import { setSetting } from '@journaling/sheets/googleSheets';

export async function GET() {
  try {
    const session = await auth();
    const email = getSessionUserKey(session);
    if (!email) return apiError('Unauthorized', 401);

    // Demo: the visitor's sandbox sheet is always connected.
    const spreadsheetId = isDemo() ? demoSheetId(email) : (await readSheetConnection(email)).spreadsheetId;
    if (!spreadsheetId || !(await claimOrCheckOwner(spreadsheetId, email))) return apiError('Setup required', 403);

    return NextResponse.json({ connected: true, spreadsheetId });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/connection');
  }
}

export async function DELETE() {
  if (isDemo()) return apiError('Not found', 404);
  try {
    const session = await auth();
    if (!getSessionUserKey(session)) return apiError('Unauthorized', 401);

    // Disconnecting turns every device off too. If that fails, still disconnect.
    try {
      const ctx = await requireSheetContext();
      if (!('status' in ctx)) await setSetting(ctx.sheetAuth, 'deviceKeys', '');
    } catch {
      console.warn('[device] could not clear keys on disconnect');
    }
    await clearSheetConnection();
    return NextResponse.json({ connected: false });
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/connection');
  }
}
