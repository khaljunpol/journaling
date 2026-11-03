// Pure model for a connected device (phone widget, watch): what one day shows. Relative imports only.
import { dayStatus, templateKind, applyTemplate, type DayData, type Ctx } from './quickDay.ts';
import { dayHasData, dayState, type DayStamp, type DayState } from './dayState.ts';
import { addDaysISO, mondayOf, weekDates } from './quickWeek.ts';
import type { HabitCategory } from './habitCategory.ts';
import { habitIcon, type HabitIcon } from './habitIcons.ts';

export type DeviceHabit = { id: string; name: string; icon: HabitIcon | null; done: boolean; category: HabitCategory | null };
export type DeviceState = {
  date: string;
  mood: number | null;
  weight: number | null;
  hours: number;
  highlight: string;
  progress: { filled: number; total: number };
  habits: DeviceHabit[];
};

/** Only with GET /api/device?include=hours, so everyday replies stay small for watches. */
export type DeviceHours = {
  categories: Array<{ id: number; name: string; color: string }>;
  slots: Array<number | null>;
};

export function deviceState(day: DayData, ctx: Ctx): DeviceState {
  const { filled, total } = dayStatus(day, ctx);
  // buildQuickPayload already keeps one row per habit (the last one wins), so this is that row's value.
  const doneIds = new Set(day.logs.filter((l) => l.completed).map((l) => l.activityId));
  return {
    date: day.date,
    mood: day.mood,
    weight: day.weight,
    hours: day.hours.filter((h) => h !== null).length,
    highlight: day.highlight,
    progress: { filled, total },
    habits: ctx.activities.map((a) => ({
      id: a.id,
      name: a.name,
      icon: habitIcon(a.name),
      done: doneIds.has(a.id),
      category: a.category ?? null,
    })),
  };
}

/** Only with GET /api/device?include=week. */
export type DeviceWeekDay = { date: string; filled: number; total: number; state?: DayState };

/** Monday to Sunday of the week holding `today`. Days after today, or not in `days`, are 0 of 0. */
export function deviceWeek(days: Record<string, DayData>, ctx: Ctx, today: string, stamps: DayStamp[] = []): DeviceWeekDay[] {
  return weekDates(mondayOf(today)).map((date) => {
    const day = date <= today ? days[date] : undefined;
    if (!day) return { date, filled: 0, total: 0 };
    const { filled, total } = dayStatus(day, ctx);
    const state = dayState(date, stamps, dayHasData(day), today);
    return state ? { date, filled, total, state } : { date, filled, total };
  });
}

/** Only with GET /api/device?include=history. */
export type DeviceHistoryDay = { date: string; mood: number | null; weight: number | null };
export const HISTORY_DAYS = 30;

/** The last HISTORY_DAYS days, oldest first, ending today. */
export function deviceHistory(days: Record<string, DayData>, today: string): DeviceHistoryDay[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = addDaysISO(today, i + 1 - HISTORY_DAYS);
    return { date, mood: days[date]?.mood ?? null, weight: days[date]?.weight ?? null };
  });
}

/** Entries for the empty slots only, from the usual template for that date. Empty array = nothing to fill. */
export function usualHoursFill(
  day: DayData,
  templates: { weekday: Array<number | null> | null; weekend: Array<number | null> | null },
  categoryIds: number[],
): Array<{ hour: number; category: number }> {
  const tpl = templates[templateKind(day.date)];
  if (!tpl) return [];
  const applied = applyTemplate(tpl, categoryIds);
  const out: Array<{ hour: number; category: number }> = [];
  for (let hour = 0; hour < 24; hour++) {
    const category = applied[hour];
    // `== null` also treats a missing slot (short array) as empty.
    if (day.hours[hour] == null && category !== null) out.push({ hour, category });
  }
  return out;
}

/** Why a usual-hours fill writes nothing. Null = there is something to write. */
export function hoursFillReason(
  day: DayData,
  templates: { weekday: Array<number | null> | null; weekend: Array<number | null> | null },
  categoryIds: number[],
): 'no_template' | 'all_filled' | null {
  if (!templates[templateKind(day.date)]) return 'no_template';
  return usualHoursFill(day, templates, categoryIds).length === 0 ? 'all_filled' : null;
}

/** The POST body a device sends. parseDeviceAction turns it into a DeviceAction. */
const HIGHLIGHT_MAX = 300;

export type DeviceRequest =
  | { action: 'mood'; score: number }
  | { action: 'habit'; activityId: string; done?: boolean }
  | { action: 'weight'; weight: number }
  | { action: 'hours'; fill?: 'usual' }
  | { action: 'hours'; entries: Array<{ hour: number; category: number }> }
  | { action: 'highlight'; text: string };

export type DeviceAction =
  | { kind: 'mood'; score: number }
  | { kind: 'habit'; activityId: string; done: boolean }
  | { kind: 'weight'; weight: number }
  | { kind: 'hours' }
  | { kind: 'hourSet'; entries: Array<{ hour: number; category: number }> }
  | { kind: 'highlight'; text: string };

/** Body of POST /api/device: { action: 'mood' | 'habit' | 'weight' | 'hours', ...fields }. Null for anything else. */
export function parseDeviceAction(body: unknown): DeviceAction | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case 'mood': {
      const s = b.score;
      return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 10 ? { kind: 'mood', score: s } : null;
    }
    case 'habit': {
      const id = b.activityId;
      if (b.done !== undefined && typeof b.done !== 'boolean') return null;
      return typeof id === 'string' && id.trim() !== '' && id.length <= 100 ? { kind: 'habit', activityId: id, done: b.done !== false } : null;
    }
    case 'weight': {
      const w = b.weight;
      return typeof w === 'number' && Number.isFinite(w) && w >= 20 && w <= 400 ? { kind: 'weight', weight: w } : null;
    }
    case 'hours': {
      if (b.entries !== undefined) {
        const e = b.entries;
        if (!Array.isArray(e) || e.length === 0 || e.length > 24) return null;
        const ok = e.every((x) => x && Number.isInteger(x.hour) && x.hour >= 0 && x.hour < 24 && Number.isInteger(x.category));
        if (!ok || new Set(e.map((x) => x.hour)).size !== e.length) return null;
        return { kind: 'hourSet', entries: e.map((x) => ({ hour: x.hour, category: x.category })) };
      }
      // Without entries: the usual template, empty slots only.
      return b.fill === undefined || b.fill === 'usual' ? { kind: 'hours' } : null;
    }
    case 'highlight':
      return typeof b.text === 'string' && b.text.length <= HIGHLIGHT_MAX ? { kind: 'highlight', text: b.text.trim() } : null;
    default:
      return null;
  }
}

/** Only the entries whose cell in the sheet row is still empty (missing or blank). Used on a fresh read, inside the write lock. */
export function pickEmptyEntries<E extends { hour: number }>(rowHours: string[], entries: E[]): E[] {
  return entries.filter((e) => (rowHours[e.hour] ?? '').trim() === '');
}
