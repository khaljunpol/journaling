import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { getSessionUserKey } from '@/lib/server/sheetContext';
import { writeSheetConnection } from '@/lib/server/sheetConnection';
import { parseSpreadsheetId } from '@/lib/setup';
import { getServiceSheets, serviceTabsClient } from '@/lib/googleSheets';
import { ensureCoreTabs } from '@/lib/sheetTabs';

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userKey = getSessionUserKey(session);
    if (!userKey || !session?.user?.email) return apiError('Unauthorized', 401);

    const { spreadsheetId: rawSpreadsheetId } = await req.json();
    const spreadsheetId = parseSpreadsheetId(String(rawSpreadsheetId || ''));
    if (!spreadsheetId) return apiError('spreadsheetId required', 400);

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

    // Create any missing core tabs (never overwrites existing ones).
    await ensureCoreTabs(serviceTabsClient(), spreadsheetId);

    // Persist the connection in a durable httpOnly cookie (survives reloads/cold starts).
    await writeSheetConnection(spreadsheetId, session.user.email);

    return NextResponse.json({ spreadsheetId });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/setup/connect');
  }
}
