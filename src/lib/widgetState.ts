// Pure model for the Android home-screen widget: what one day shows. Relative imports only.
import { dayStatus, templateKind, applyTemplate, type DayData, type Ctx } from './quickDay.ts';
import { habitIcon, type HabitIcon } from './habitIcons.ts';

export type WidgetHabit = { id: string; name: string; icon: HabitIcon | null; done: boolean };
export type WidgetState = {
  date: string;
  mood: number | null;
  weight: number | null;
  hours: number;
  progress: { filled: number; total: number };
  habits: WidgetHabit[];
};

export function widgetState(day: DayData, ctx: Ctx): WidgetState {
  const { filled, total } = dayStatus(day, ctx);
  // buildQuickPayload already keeps one row per habit (the last one wins), so this is that row's value.
  const doneIds = new Set(day.logs.filter((l) => l.completed).map((l) => l.activityId));
  return {
    date: day.date,
    mood: day.mood,
    weight: day.weight,
    hours: day.hours.filter((h) => h !== null).length,
    progress: { filled, total },
    habits: ctx.activities.map((a) => ({
      id: a.id,
      name: a.name,
      icon: habitIcon(a.name),
      done: doneIds.has(a.id),
    })),
  };
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

export type WidgetAction =
  | { kind: 'mood'; score: number }
  | { kind: 'habit'; activityId: string }
  | { kind: 'weight'; weight: number }
  | { kind: 'hours' };

/** Body of POST /api/widget: { action: 'mood' | 'habit' | 'weight' | 'hours', ...fields }. Null for anything else. */
export function parseWidgetAction(body: unknown): WidgetAction | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case 'mood': {
      const s = b.score;
      return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 10 ? { kind: 'mood', score: s } : null;
    }
    case 'habit': {
      const id = b.activityId;
      return typeof id === 'string' && id.trim() !== '' && id.length <= 100 ? { kind: 'habit', activityId: id } : null;
    }
    case 'weight': {
      const w = b.weight;
      return typeof w === 'number' && Number.isFinite(w) && w >= 20 && w <= 400 ? { kind: 'weight', weight: w } : null;
    }
    case 'hours':
      // The only fill there is: the usual template, empty slots only.
      return b.fill === undefined || b.fill === 'usual' ? { kind: 'hours' } : null;
    default:
      return null;
  }
}

/** Only the entries whose cell in the sheet row is still empty (missing or blank). Used on a fresh read, inside the write lock. */
export function pickEmptyEntries<E extends { hour: number }>(rowHours: string[], entries: E[]): E[] {
  return entries.filter((e) => (rowHours[e.hour] ?? '').trim() === '');
}
