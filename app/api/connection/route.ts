import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { getSessionUserKey } from '@/lib/server/sheetContext';
import {
  clearSheetConnection,
  readSheetConnection,
  setActiveAccount,
} from '@/lib/server/sheetConnection';

export async function GET() {
  try {
    const session = await auth();
    if (!getSessionUserKey(session)) return apiError('Unauthorized', 401);

    const { spreadsheetId, account } = await readSheetConnection();
    if (!spreadsheetId) return apiError('Setup required', 403);

    return NextResponse.json({
      connected: true,
      spreadsheetId,
      activeSubAccount: account || 'default',
    });
  } catch (error: unknown) {
    console.error('[GET /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!getSessionUserKey(session)) return apiError('Unauthorized', 401);

    const { spreadsheetId } = await readSheetConnection();
    if (!spreadsheetId) return apiError('Setup required', 403);

    const { activeSubAccount } = await req.json();
    const account = String(activeSubAccount || '').trim();
    if (!account) return apiError('activeSubAccount required', 400);

    await setActiveAccount(account);

    return NextResponse.json({ connected: true, spreadsheetId, activeSubAccount: account });
  } catch (error: unknown) {
    console.error('[PATCH /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!getSessionUserKey(session)) return apiError('Unauthorized', 401);

    await clearSheetConnection();
    return NextResponse.json({ connected: false });
  } catch (error: unknown) {
    console.error('[DELETE /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
