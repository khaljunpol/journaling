import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { google } from 'googleapis';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.accessToken) return apiError('Unauthorized', 401);
    if (!session.spreadsheetId) return apiError('Setup required', 403);

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: client });
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: session.spreadsheetId,
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
