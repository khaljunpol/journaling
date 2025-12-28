import { appendLog, getLogsBetween, getLogsForDate } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function OPTIONS() {
    // Allow CORS/preflight or generic method probing
    return NextResponse.json({ ok: true }, { status: 200 });
}

export async function HEAD(req: Request) {
    // Basic health response
    return NextResponse.json({}, { status: 200 });
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const account = url.searchParams.get('account') || 'Alex';
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
        return NextResponse.json({ error: 'date or from+to required' }, { status: 400 });
    } catch (e: any) {
        // Return empty array to avoid breaking client if Sheets fails
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(req: Request) {
    try {
        const url = new URL(req.url);
        const account = url.searchParams.get('account') || 'Alex';
        const body = await req.json();
        const date = String(body?.date || '');
        const activityId = String(body?.activityId || '');
        const completed = Boolean(body?.completed);
        if (!date || !activityId) {
            return NextResponse.json({ error: 'date and activityId required' }, { status: 400 });
        }
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
            return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
        }
        await appendLog(account, date, activityId, completed);
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e: any) {
        const msg = String(e?.message || 'Unknown error');
        if (msg.includes('Missing GOOGLE_SPREADSHEET_ID') || msg.includes('Missing Google service account')) {
            return NextResponse.json({ error: 'Google Sheets not configured. Set env vars and share the sheet to the service account.' }, { status: 503 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
