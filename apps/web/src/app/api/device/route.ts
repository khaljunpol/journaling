import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { authDevice } from '@/lib/server/deviceAuth';
import { loadQuickPayload } from '@/lib/server/loadQuick';
import { setMood, upsertLog, setWeight, upsertHourLogsBatch, tabCache, type SheetAuth, listTimeCategories, setHighlight, getLogsBetween, getMoodsBetween, listHourLogs } from '@journaling/sheets/googleSheets';
import { appDateISO } from '@/lib/reminder';
import { deviceHistory, deviceState, deviceWeek, HISTORY_DAYS, usualHoursFill, hoursFillReason, parseDeviceAction, type DeviceState, type DeviceHours } from '@journaling/core/deviceState';
import { deviceInsights } from '@journaling/core/deviceInsights';
import { addDaysISO, mondayOf } from '@journaling/core/quickWeek';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 1024;
const MAX_HEADER_BYTES = 2048;
const NO_STORE = { 'Cache-Control': 'no-store' };

/** apiError with no-store, so no proxy keeps an error reply. */
function fail(message: string, status: number) {
  const res = apiError(message, status);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/**
 * apiFailure keeps its logging and its 429/5xx. Google's own 401/403/404 become 503:
 * a device reads 401 as a bad key and 404 as a deleted habit, and neither is true here.
 */
function failed(error: unknown, context: string) {
  const res = apiFailure(error, context);
  if ([401, 403, 404].includes(res.status)) return fail('Try again', 503);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function refused() {
  return NextResponse.json({ error: 'key' }, { status: 401, headers: NO_STORE });
}

async function load(sheetAuth: SheetAuth, today: string, from = today) {
  const { payload } = await loadQuickPayload(sheetAuth, from, today);
  const day = payload.days[today];
  if (!day) throw new Error('Day missing from payload');
  return { payload, day };
}

async function stateFor(sheetAuth: SheetAuth, today: string): Promise<DeviceState> {
  const { payload, day } = await load(sheetAuth, today);
  return deviceState(day, payload.ctx);
}

/** Today's device state. The server decides the date (the app's time zone). ?include=hours adds the categories and slots; ?include=week adds Monday to Sunday; ?include=history adds the last 30 days of mood and weight; ?include=insights adds the Overview's answers. */
export async function GET(req: Request) {
  try {
    const auth = await authDevice(req);
    if (!auth) return refused();
    const today = appDateISO(new Date());
    const include = new URL(req.url).searchParams.get('include');
    if (include === 'week') {
      const { payload, day } = await load(auth.sheetAuth, today, mondayOf(today));
      return NextResponse.json({ ...deviceState(day, payload.ctx), week: deviceWeek(payload.days, payload.ctx, today) }, { status: 200, headers: NO_STORE });
    }
    if (include === 'history') {
      const { payload, day } = await load(auth.sheetAuth, today, addDaysISO(today, 1 - HISTORY_DAYS));
      return NextResponse.json({ ...deviceState(day, payload.ctx), history: deviceHistory(payload.days, today) }, { status: 200, headers: NO_STORE });
    }
    if (include === 'insights') {
      const { payload, day } = await load(auth.sheetAuth, today);
      const from90 = addDaysISO(today, -89);
      const [moods, hours, logs, cats] = await Promise.all([
        getMoodsBetween(auth.sheetAuth, from90, today),
        listHourLogs(auth.sheetAuth, from90, today),
        // Streaks reach back to the start of last year, same as the Overview.
        getLogsBetween(auth.sheetAuth, `${Number(today.slice(0, 4)) - 1}-01-01`, today),
        listTimeCategories(auth.sheetAuth),
      ]);
      const activeIds = new Set(payload.ctx.activities.map((a) => a.id));
      const insights = deviceInsights({ today, moods, hours, logs, cats, activeIds });
      return NextResponse.json({ ...deviceState(day, payload.ctx), insights }, { status: 200, headers: NO_STORE });
    }
    if (include === 'hours') {
      const { payload, day } = await load(auth.sheetAuth, today);
      const categories = (await listTimeCategories(auth.sheetAuth)).map((c) => ({ id: Number(c.id), name: c.name, color: c.color }));
      const hours: DeviceHours = { categories, slots: day.hours };
      return NextResponse.json({ ...deviceState(day, payload.ctx), ...hours }, { status: 200, headers: NO_STORE });
    }
    return NextResponse.json(await stateFor(auth.sheetAuth, today), { status: 200, headers: NO_STORE });
  } catch (error: unknown) {
    return failed(error, 'GET /api/device');
  }
}

/** Run one action for today, then return the new state. Every action is safe to repeat. */
export async function POST(req: Request) {
  try {
    // Refuse a big body before reading it or the sheet; the check after reading covers a missing or wrong header.
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MAX_HEADER_BYTES) return fail('Action is too large', 413);
    // Key next: nothing is read from the body or the sheet before it passes.
    const auth = await authDevice(req);
    if (!auth) return refused();
    const { sheetAuth } = auth;

    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BYTES) return fail('Action is too large', 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail('Invalid action', 400);
    }
    const action = parseDeviceAction(body);
    if (!action) return fail('Invalid action', 400);

    const today = appDateISO(new Date());
    switch (action.kind) {
      case 'mood':
        await setMood(sheetAuth, today, action.score);
        break;
      case 'weight':
        await setWeight(sheetAuth, today, action.weight);
        break;
      case 'habit': {
        // Fresh habit list, so a habit deleted a moment ago answers habit_gone.
        tabCache.invalidate(sheetAuth.spreadsheetId, 'activities');
        const { payload } = await load(sheetAuth, today);
        if (!payload.ctx.activities.some((a) => a.id === action.activityId)) return fail('habit_gone', 404);
        await upsertLog(sheetAuth, today, action.activityId, action.done);
        break;
      }
      case 'highlight':
        await setHighlight(sheetAuth, today, action.text);
        break;
      case 'hourSet': {
        const { payload } = await load(sheetAuth, today);
        const known = new Set(payload.ctx.categoryIds);
        if (!action.entries.every((e) => known.has(e.category))) return fail('Invalid action', 400);
        // The person chose these hours, so they replace what is there.
        await upsertHourLogsBatch(sheetAuth, { date: today, entries: action.entries });
        break;
      }
      case 'hours': {
        const { payload, day } = await load(sheetAuth, today);
        const entries = usualHoursFill(day, payload.templates, payload.ctx.categoryIds);
        if (entries.length === 0) {
          // No usual template for today's kind, or every slot is already filled.
          const reason = hoursFillReason(day, payload.templates, payload.ctx.categoryIds);
          return NextResponse.json(
            { ...deviceState(day, payload.ctx), filled: 0, reason },
            { status: 200, headers: NO_STORE },
          );
        }
        // The cached read can be old: the writer re-checks each slot on a fresh read and skips filled ones.
        const { count } = await upsertHourLogsBatch(sheetAuth, { date: today, entries }, { onlyEmpty: true });
        return NextResponse.json(
          {
            ...(await stateFor(sheetAuth, today)),
            filled: count,
            ...(count === 0 ? { reason: 'all_filled' as const } : {}),
          },
          { status: 200, headers: NO_STORE },
        );
      }
    }
    // The writers invalidate tabCache, so this re-read sees the new value.
    return NextResponse.json(await stateFor(sheetAuth, today), { status: 200, headers: NO_STORE });
  } catch (error: unknown) {
    return failed(error, 'POST /api/device');
  }
}
