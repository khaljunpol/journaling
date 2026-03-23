import { appendLog, getLogsBetween, getLogsForDate } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';
import { apiError, getAccountParam } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function OPTIONS() {
    return NextResponse.json({ ok: true }, { status: 200 });
}

export async function HEAD() {
    return NextResponse.json({}, { status: 200 });
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const account = getAccountParam(url);
        if (!account) return apiError('Invalid account', 400);
        const date = url.searchParams.get('date');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        if (date) {
            const logs = await getLogsForDate(account, date);
            return NextResponse.json(logs, { status: 200 });
        }
        if (from && to) {
            const logs = await getLogsBetween(account, from, to);
            return NextResponse.json(logs, { status: 200 });
        }
        return apiError('date or from+to required', 400);
    } catch (e: any) {
        console.error('[GET /api/logs]', e);
        return apiError('Failed to fetch logs', 503);
    }
}

export async function POST(req: Request) {
    try {
        const url = new URL(req.url);
        const account = getAccountParam(url);
        if (!account) return apiError('Invalid account', 400);
        const body = await req.json();
        const date = String(body?.date || '');
        const activityId = String(body?.activityId || '');
        const completed = Boolean(body?.completed);
        if (!date || !activityId) {
            return apiError('date and activityId required', 400);
        }
        await appendLog(account, date, activityId, completed);
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e: any) {
        console.error('[POST /api/logs]', e);
        const msg = String(e?.message || '');
        if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
            return apiError('Google Sheets not configured', 503);
        }
        return apiError(msg || 'Unknown error', 500);
    }
}
