import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { apiError } from '@/lib/apiHelpers';
import { apiErrorBody } from '@/lib/server/apiError';
import { loadQuickPayload } from '@/lib/server/loadQuick';
import { setSetting } from '@/lib/googleSheets';
import { dayStatus } from '@journaling/core/quickDay';
import { checkCronAuth, shouldRemind, appDateISO } from '@/lib/reminder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MESSAGE = JSON.stringify({ title: 'Journal', body: 'A few things left for today', tag: 'daily-checkin' });

function sheetIds(): string[] {
  return (process.env.REMINDER_SHEET_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One sheet: send at most one reminder. Returns true when a push was sent. */
async function remindOne(spreadsheetId: string, today: string): Promise<boolean> {
  const sheetAuth = { spreadsheetId };
  // Read only: no tab creation from the cron.
  const { payload, settings } = await loadQuickPayload(sheetAuth, today, today);
  const day = payload.days[today];
  if (!day) return false;
  const status = dayStatus(day, payload.ctx);
  let subscription: webpush.PushSubscription | null = null;
  try {
    subscription = settings.pushSubscription ? (JSON.parse(settings.pushSubscription) as webpush.PushSubscription) : null;
  } catch {
    subscription = null;
  }
  if (!shouldRemind({ enabled: payload.reminderEnabled, hasSubscription: !!subscription, status })) return false;
  try {
    await webpush.sendNotification(subscription as webpush.PushSubscription, MESSAGE, { TTL: 3600, timeout: 8000 });
    return true;
  } catch (err: unknown) {
    const code = (err as { statusCode?: number } | null)?.statusCode;
    if (code === 404 || code === 410) {
      // The phone dropped this subscription. Switch the reminder off and forget the dead address.
      await setSetting(sheetAuth, 'reminderEnabled', '0');
      await setSetting(sheetAuth, 'pushSubscription', '');
      return false;
    }
    throw err;
  }
}

async function run(req: Request): Promise<NextResponse> {
  // Check the secret before any sheet access.
  if (!checkCronAuth(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return apiError('Unauthorized', 401);
  }
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.error('[reminder/run] VAPID settings are missing');
    return apiError('Reminder is not set up', 500);
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    console.error('[reminder/run] VAPID settings are invalid');
    return apiError('Reminder is not set up', 500);
  }

  const today = appDateISO(new Date());
  let sent = 0;
  for (const id of sheetIds()) {
    try {
      if (await remindOne(id, today)) sent += 1;
    } catch (err: unknown) {
      // Logged redacted (no ids, no subscription). The other sheets still run.
      apiErrorBody(err, 'reminder/run');
    }
  }
  return NextResponse.json({ sent }, { status: 200 });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
