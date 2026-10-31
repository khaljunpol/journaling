import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { getSessionUserKey } from '@/lib/server/sheetContext';
import {
  clearSheetConnection,
  readSheetConnection,
} from '@/lib/server/sheetConnection';
import { claimOrCheckOwner } from '@/lib/server/sheetOwner';
import { requireSheetContext } from '@/lib/sheetAuth';
import { setSetting } from '@/lib/googleSheets';

export async function GET() {
  try {
    const session = await auth();
    const email = getSessionUserKey(session);
    if (!email) return apiError('Unauthorized', 401);

    const { spreadsheetId } = await readSheetConnection(email);
    if (!spreadsheetId || !(await claimOrCheckOwner(spreadsheetId, email))) return apiError('Setup required', 403);

    return NextResponse.json({ connected: true, spreadsheetId });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/connection');
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!getSessionUserKey(session)) return apiError('Unauthorized', 401);

    // Disconnecting turns the widget off too. If that fails, still disconnect.
    try {
      const ctx = await requireSheetContext();
      if (!('status' in ctx)) await setSetting(ctx.sheetAuth, 'widgetKeyHash', '');
    } catch {
      console.warn('[widget] could not clear key on disconnect');
    }
    await clearSheetConnection();
    return NextResponse.json({ connected: false });
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/connection');
  }
}
