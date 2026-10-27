import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { setSetting } from '@/lib/googleSheets';
import { isPushEndpoint } from '@/lib/reminder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 2048;

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Accept only the shape a browser gives us. Returns a clean copy, or null. */
function cleanSubscription(v: unknown): Sub | null {
  if (!v || typeof v !== 'object') return null;
  const { endpoint, keys } = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== 'string') return null;
  if (!isPushEndpoint(endpoint)) return null;
  if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null;
  if (!keys.p256dh || !keys.auth) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return apiError('Subscription is too large', 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return apiError('Invalid subscription', 400);
    }
    const sub = cleanSubscription(parsed);
    if (!sub) return apiError('Invalid subscription', 400);
    const json = JSON.stringify(sub);
    if (json.length > MAX_BYTES) return apiError('Subscription is too large', 413);
    await setSetting(ctx.sheetAuth, 'pushSubscription', json);
    await setSetting(ctx.sheetAuth, 'reminderEnabled', '1');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/push/subscribe');
  }
}

export async function DELETE() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    await setSetting(ctx.sheetAuth, 'reminderEnabled', '0');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/push/subscribe');
  }
}
