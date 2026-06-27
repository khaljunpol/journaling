import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { getStoredSheetContextForSession } from '@/lib/server/sheetContext';

export async function GET() {
  try {
    const session = await auth();
    const ctx = getStoredSheetContextForSession(session);
    if (!ctx.ok) return apiError(ctx.message, ctx.status);

    return NextResponse.json({
      connected: true,
      spreadsheetId: ctx.context.sheetAuth.spreadsheetId,
      activeSubAccount: ctx.context.account,
    });
  } catch (error: unknown) {
    console.error('[GET /api/connection]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
