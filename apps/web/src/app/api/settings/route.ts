import { getSettings, setSetting } from '@journaling/sheets/googleSheets';
import { NextResponse } from 'next/server';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';
import { parseTemplate, parseHabitTemplate } from '@journaling/core/quickDay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function readTemplate(raw: string | undefined) {
  if (!raw) return null;
  try {
    return parseTemplate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readHabits(raw: string | undefined) {
  if (!raw) return null;
  try {
    return parseHabitTemplate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const s = await getSettings(ctx.sheetAuth);
    // Only these keys leave the server. pushSubscription and deviceKeys are never returned.
    return NextResponse.json({
      hourTemplateWeekday: readTemplate(s.hourTemplateWeekday),
      hourTemplateWeekend: readTemplate(s.hourTemplateWeekend),
      habitTemplateWeekday: readHabits(s.habitTemplateWeekday),
      habitTemplateWeekend: readHabits(s.habitTemplateWeekend),
      reminderEnabled: s.reminderEnabled === '1',
    }, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/settings');
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const writes: Array<[string, string]> = [];
    for (const key of ['hourTemplateWeekday', 'hourTemplateWeekend'] as const) {
      if (body?.[key] === undefined) continue;
      const tpl = parseTemplate(body[key]);
      if (!tpl) return apiError(`${key} must be 24 integers or null`, 400);
      writes.push([key, JSON.stringify(tpl)]);
    }
    for (const key of ['habitTemplateWeekday', 'habitTemplateWeekend'] as const) {
      if (body?.[key] === undefined) continue;
      const ids = parseHabitTemplate(body[key]);
      if (!ids) return apiError(`${key} must be up to 100 activity ids`, 400);
      writes.push([key, JSON.stringify(ids)]);
    }
    if (body?.reminderEnabled !== undefined) {
      if (typeof body.reminderEnabled !== 'boolean') return apiError('reminderEnabled must be true or false', 400);
      writes.push(['reminderEnabled', body.reminderEnabled ? '1' : '0']);
    }
    for (const [key, value] of writes) await setSetting(ctx.sheetAuth, key, value);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'PUT /api/settings');
  }
}
