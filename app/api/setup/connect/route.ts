import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { getSessionUserKey } from '@/lib/server/sheetContext';
import { parseSpreadsheetId } from '@/lib/setup';
import { getServiceSheets } from '@/lib/googleSheets';

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userKey = getSessionUserKey(session);
    if (!userKey || !session?.user?.email) return apiError('Unauthorized', 401);

    const { spreadsheetId: rawSpreadsheetId, subAccountName } = await req.json();
    const spreadsheetId = parseSpreadsheetId(String(rawSpreadsheetId || ''));
    const name = String(subAccountName || '').trim();
    if (!spreadsheetId) return apiError('spreadsheetId required', 400);
    if (!name) return apiError('subAccountName required', 400);

    // Verify the shared service account can actually reach this sheet.
    try {
      const sheets = getServiceSheets();
      await sheets.spreadsheets.get({ spreadsheetId, fields: 'spreadsheetId' });
    } catch (error: unknown) {
      const status = (error as { code?: number; status?: number })?.code
        ?? (error as { status?: number })?.status;
      if (status === 403 || status === 404) {
        return apiError(
          `Can't access that sheet. Open it in Google Sheets, click Share, and add ${serviceAccountEmail || 'the app service account'} as an Editor — then try again.`,
          403,
        );
      }
      throw error;
    }

    // The connection (spreadsheetId + sub-account) is persisted client-side into the
    // JWT via session.update(); nothing is stored server-side.
    return NextResponse.json({ spreadsheetId, subAccountName: name });
  } catch (error: unknown) {
    console.error('[POST /api/setup/connect]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
