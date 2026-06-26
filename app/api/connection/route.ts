import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import {
  clearGoogleConnection,
  getGoogleConnection,
  saveGoogleConnection,
} from '@/lib/server/googleConnectionStore';
import { getSessionUserKey } from '@/lib/server/sheetContext';

async function getCurrentUser() {
  const session = await auth();
  const userKey = getSessionUserKey(session);
  if (!session?.user?.email || !userKey) return null;
  return { session, userKey, email: session.user.email };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('Unauthorized', 401);

    const connection = await getGoogleConnection(user.userKey);
    if (!connection) return apiError('Setup required', 403);

    return NextResponse.json({
      connected: true,
      spreadsheetId: connection.spreadsheetId,
      activeSubAccount: connection.activeSubAccount,
      reconnectRequired: connection.reconnectRequired,
      reconnectReason: connection.reconnectReason ?? null,
    });
  } catch (error: unknown) {
    console.error('[GET /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('Unauthorized', 401);

    const connection = await getGoogleConnection(user.userKey);
    if (!connection) return apiError('Setup required', 403);

    const { activeSubAccount } = await req.json();
    const account = String(activeSubAccount || '').trim();
    if (!account) return apiError('activeSubAccount required', 400);

    const updated = await saveGoogleConnection(user.userKey, {
      email: user.email,
      refreshToken: connection.refreshToken,
      accessToken: connection.accessToken,
      accessTokenExpires: connection.accessTokenExpires,
      spreadsheetId: connection.spreadsheetId,
      activeSubAccount: account,
      reconnectRequired: connection.reconnectRequired,
      reconnectReason: connection.reconnectReason,
    });

    return NextResponse.json({
      connected: true,
      spreadsheetId: updated.spreadsheetId,
      activeSubAccount: updated.activeSubAccount,
      reconnectRequired: updated.reconnectRequired,
      reconnectReason: updated.reconnectReason ?? null,
    });
  } catch (error: unknown) {
    console.error('[PATCH /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('Unauthorized', 401);

    await clearGoogleConnection(user.userKey);
    return NextResponse.json({ connected: false });
  } catch (error: unknown) {
    console.error('[DELETE /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
