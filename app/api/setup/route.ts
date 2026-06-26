import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { saveGoogleConnection } from '@/lib/server/googleConnectionStore';
import { getSessionUserKey } from '@/lib/server/sheetContext';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.accessToken) return apiError('Unauthorized', 401);
    const userKey = getSessionUserKey(session);
    if (!userKey || !session.user?.email) return apiError('Unauthorized', 401);

    const { subAccountName, folderName } = await req.json();
    const name = String(subAccountName || '').trim();
    if (!name) return apiError('subAccountName required', 400);

    const oauthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauthClient.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauthClient });
    const sheets = google.sheets({ version: 'v4', auth: oauthClient });

    // Create folder if specified
    let parents: string[] | undefined;
    if (folderName && String(folderName).trim()) {
      const folder = await drive.files.create({
        requestBody: {
          name: String(folderName).trim(),
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      if (folder.data.id) parents = [folder.data.id];
    }

    // Create spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: { properties: { title: 'Journaling' } },
      fields: 'spreadsheetId',
    });
    const spreadsheetId = spreadsheet.data.spreadsheetId;
    if (!spreadsheetId) return apiError('Failed to create spreadsheet', 500);

    // Move to folder if created
    if (parents?.length) {
      const file = await drive.files.get({ fileId: spreadsheetId, fields: 'parents' });
      const oldParents = (file.data.parents || []).join(',');
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: parents[0],
        removeParents: oldParents,
        fields: 'id, parents',
      });
    }

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
    console.error('[POST /api/setup]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
