import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { saveGoogleConnection } from '@/lib/server/googleConnectionStore';
import { getSessionUserKey } from '@/lib/server/sheetContext';
import { parseSpreadsheetId } from '@/lib/setup';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.accessToken) return apiError('Unauthorized', 401);
    const userKey = getSessionUserKey(session);
    if (!userKey || !session.user?.email) return apiError('Unauthorized', 401);

    const { spreadsheetId: rawSpreadsheetId, subAccountName } = await req.json();
    const spreadsheetId = parseSpreadsheetId(String(rawSpreadsheetId || ''));
    const name = String(subAccountName || '').trim();
    if (!spreadsheetId) return apiError('spreadsheetId required', 400);
    if (!name) return apiError('subAccountName required', 400);

    const oauthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauthClient.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauthClient });
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId',
    });

    await saveGoogleConnection(userKey, {
      email: session.user.email,
      refreshToken: session.refreshToken || undefined,
      accessToken: session.accessToken,
      accessTokenExpires: session.accessTokenExpires,
      spreadsheetId,
      activeSubAccount: name,
    });

    return NextResponse.json({ spreadsheetId, subAccountName: name });
  } catch (error: unknown) {
    console.error('[POST /api/setup/connect]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
