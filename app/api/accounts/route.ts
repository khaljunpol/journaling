import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { google } from 'googleapis';
import { getStoredSheetContextForSession } from '@/lib/server/sheetContext';

export async function GET() {
  try {
    const session = await auth();
    const ctx = await getStoredSheetContextForSession(session);
    if (!ctx.ok) return apiError(ctx.message, ctx.status);

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    client.setCredentials({
      access_token: ctx.context.sheetAuth.accessToken,
      refresh_token: ctx.context.sheetAuth.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: client });
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: ctx.context.sheetAuth.spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const titles = (meta.data.sheets || [])
      .map((s) => s.properties?.title || '')
      .filter(Boolean);

    // Extract sub-account names from tab titles like "Activities_Alex" → "Alex"
    const accounts = Array.from(
      new Set(
        titles
          .map((t) => {
            const m = t.match(/^Activities_(.+)$/);
            return m ? m[1] : null;
          })
          .filter((x): x is string => x !== null),
      ),
    );

    return NextResponse.json(accounts);
  } catch (error: unknown) {
    console.error('[GET /api/accounts]', getErrorMessage(error));
    return apiError('Failed to fetch accounts', 503);
  }
}
