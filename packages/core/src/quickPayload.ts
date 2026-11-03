// Pure builder for GET /api/quick. Gets typed rows (already parsed), returns the board payload.
import type { HabitCategory } from './habitCategory.ts';
import type { DayStamp } from './dayState.ts';
import type { DayData, Ctx } from './quickDay.ts';
import { parseTemplate, parseHabitTemplate } from './quickDay.ts';

export type QuickRows = {
  activities: Array<{ id: string; name: string; status?: string; category?: HabitCategory }>;
  logs: Array<{ date: string; activityId: string; completed: boolean }>;
  moods: Array<{ date: string; score: number }>;
  weights: Array<{ date: string; weight: number }>;
  highlights: Array<{ date: string; text: string }>;
  hours: Array<{ date: string; hour: number; category: number }>;
  climbs: Array<{ date: string }>;
  sidequests: Array<{ id: string; type: string; completedAt?: string; year: number }>;
  sidequestLogs: Array<{ sidequestId: string; date: string; value?: number; milestoneIndex?: number }>;
  categories: Array<{ id: string }>;
  stamps?: DayStamp[];
};

export type QuickPayload = {
  ctx: Ctx;
  days: Record<string, DayData>;
  templates: { weekday: Array<number | null> | null; weekend: Array<number | null> | null };
  habitTemplates: { weekday: string[] | null; weekend: string[] | null };
  reminderEnabled: boolean;
  /** When each part of a day was first logged. Missing in copies saved before this existed. */
  stamps?: DayStamp[];
};

/** Every YYYY-MM-DD from `from` to `to`, inclusive. Uses UTC so DST cannot skip a day. */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const end = Date.UTC(ty, tm - 1, td);
  for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function parseJson(s: string | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function buildQuickPayload(
  rows: QuickRows,
  from: string,
  to: string,
  settings: Record<string, string>,
): QuickPayload {
  const dates = datesBetween(from, to);
  const days: Record<string, DayData> = {};
  const logMaps: Record<string, Map<string, boolean>> = {};
  const questSets: Record<string, Set<string>> = {};
  for (const date of dates) {
    days[date] = {
      date,
      mood: null,
      weight: null,
      highlight: '',
      logs: [],
      hours: Array.from({ length: 24 }, () => null),
      climbs: 0,
      sidequestLogIds: [],
      sidequestValues: {},
    };
    logMaps[date] = new Map();
    questSets[date] = new Set();
  }

  // Later rows overwrite earlier ones, so the last row wins.
  for (const l of rows.logs) if (days[l.date]) logMaps[l.date].set(l.activityId, l.completed);
  for (const date of dates) {
    days[date].logs = [...logMaps[date]].map(([activityId, completed]) => ({ activityId, completed }));
  }
  for (const m of rows.moods) if (days[m.date]) days[m.date].mood = m.score;
  for (const w of rows.weights) if (days[w.date]) days[w.date].weight = w.weight;
  for (const h of rows.highlights) if (days[h.date]) days[h.date].highlight = h.text;
  for (const h of rows.hours) {
    if (days[h.date] && Number.isInteger(h.hour) && h.hour >= 0 && h.hour < 24) days[h.date].hours[h.hour] = h.category;
  }
  for (const c of rows.climbs) if (days[c.date]) days[c.date].climbs += 1;
  for (const s of rows.sidequestLogs) {
    if (!days[s.date]) continue;
    questSets[s.date].add(s.sidequestId);
    if (s.milestoneIndex == null && typeof s.value === 'number') {
      const v = days[s.date].sidequestValues!;
      v[s.sidequestId] = (v[s.sidequestId] ?? 0) + s.value;
    }
  }
  for (const date of dates) days[date].sidequestLogIds = [...questSets[date]];

  const ctx: Ctx = {
    activities: rows.activities.map((a) => ({ id: a.id, name: a.name, status: a.status, category: a.category })),
    categoryIds: rows.categories.map((c) => Number(c.id)),
    sidequests: rows.sidequests.map((q) => ({ id: q.id, type: q.type, completedAt: q.completedAt, year: q.year })),
    year: Number(to.slice(0, 4)),
  };

  return {
    ctx,
    days,
    templates: {
      weekday: parseTemplate(parseJson(settings.hourTemplateWeekday)),
      weekend: parseTemplate(parseJson(settings.hourTemplateWeekend)),
    },
    habitTemplates: {
      weekday: parseHabitTemplate(parseJson(settings.habitTemplateWeekday)),
      weekend: parseHabitTemplate(parseJson(settings.habitTemplateWeekend)),
    },
    reminderEnabled: settings.reminderEnabled === '1',
    stamps: rows.stamps ?? [],
  };
}
