// Pure model for the /quick check-in: which daily items are filled. No imports, so tests can load it.

export type ItemKey = 'mood' | 'habits' | 'weight' | 'sidequests' | 'hours' | 'highlight' | 'climb';

export type DayData = {
  date: string;
  mood: number | null;
  weight: number | null;
  highlight: string;
  logs: Array<{ activityId: string; completed: boolean }>;
  hours: Array<number | null>; // length 24
  climbs: number; // count of climb rows
  sidequestLogIds: string[]; // sidequestIds logged that day
};

export type Ctx = {
  activities: Array<{ id: string; name: string; status?: string }>;
  categoryIds: number[];
  sidequests: Array<{ id: string; type: string; completedAt?: string; year: number }>;
  year: number;
};

export type ItemStatus = { key: ItemKey; shown: boolean; filled: boolean; counts: boolean };

const ORDER: ItemKey[] = ['mood', 'habits', 'weight', 'sidequests', 'hours', 'highlight'];

/** `only`: count just these kinds (older days, where the user chose what to catch up). Others still show, but do not count. */
export function dayStatus(
  day: DayData,
  ctx: Ctx,
  opts?: { only?: ItemKey[] },
): { items: ItemStatus[]; filled: number; total: number } {
  const active = ctx.activities.filter((a) => a.status !== 'stopped');
  const quests = ctx.sidequests.filter(
    (q) => (q.type === 'count' || q.type === 'timed') && !q.completedAt && q.year === ctx.year,
  );
  const logged = new Set(day.logs.map((l) => l.activityId));
  const questLogged = new Set(day.sidequestLogIds);
  const valid = new Set(ctx.categoryIds);

  const habitsApplicable = active.length > 0 || day.logs.length > 0;
  const items: ItemStatus[] = [
    { key: 'mood', shown: true, filled: day.mood !== null, counts: true },
    {
      key: 'habits',
      shown: habitsApplicable,
      filled: active.length > 0 && active.every((a) => logged.has(a.id)),
      counts: active.length > 0,
    },
    { key: 'weight', shown: true, filled: day.weight !== null, counts: true },
    {
      key: 'sidequests',
      shown: quests.length > 0,
      filled: quests.some((q) => questLogged.has(q.id)),
      counts: quests.length > 0,
    },
    {
      key: 'hours',
      shown: true,
      filled: day.hours.length === 24 && day.hours.every((h) => h !== null && valid.has(h)),
      counts: true,
    },
    { key: 'highlight', shown: true, filled: day.highlight.trim() !== '', counts: true },
    { key: 'climb', shown: day.climbs > 0, filled: day.climbs > 0, counts: false },
  ];

  const only = opts?.only;
  if (only) for (const i of items) if (!only.includes(i.key)) i.counts = false;

  const counted = items.filter((i) => i.counts);
  return { items, filled: counted.filter((i) => i.filled).length, total: counted.length };
}

/** Counted items that are still empty, in card order. */
export function missingInOrder(status: ReturnType<typeof dayStatus>): ItemKey[] {
  return ORDER.filter((key) => {
    const item = status.items.find((i) => i.key === key);
    return item !== undefined && item.counts && !item.filled;
  });
}

/** Saturday and Sunday are weekend. The date is read as a local calendar date. */
export function templateKind(dateISO: string): 'weekday' | 'weekend' {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday';
}

/** Copy a template, turning ids that are no longer categories into null. */
export function applyTemplate(tpl: Array<number | null> | null, categoryIds: number[]): Array<number | null> {
  const valid = new Set(categoryIds);
  return Array.from({ length: 24 }, (_, i) => {
    const id = tpl?.[i] ?? null;
    return id !== null && valid.has(id) ? id : null;
  });
}

/** A saved habit template: up to 100 non-empty activity ids. Anything else gives null. */
export function parseHabitTemplate(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 100) return null;
  return v.every((x) => typeof x === 'string' && x !== '') ? (v as string[]) : null;
}

/** Starting ticks for the habits card. Logs win; on an empty day use the template (active habits only). */
export function initialTicks(
  logs: Array<{ activityId: string; completed: boolean }>,
  template: string[] | null,
  activities: Array<{ id: string; status?: string }>,
): { ticked: Set<string>; fromTemplate: boolean } {
  if (logs.length > 0) {
    return { ticked: new Set(logs.filter((l) => l.completed).map((l) => l.activityId)), fromTemplate: false };
  }
  const active = new Set(activities.filter((a) => a.status !== 'stopped').map((a) => a.id));
  const ticked = new Set((template ?? []).filter((id) => active.has(id)));
  return { ticked, fromTemplate: ticked.size > 0 };
}

/** A saved hour template: exactly 24 items, each an integer >= 0 or null. Anything else gives null. */
export function parseTemplate(v: unknown): Array<number | null> | null {
  if (!Array.isArray(v) || v.length !== 24) return null;
  const ok = v.every((x) => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 0));
  return ok ? (v as Array<number | null>) : null;
}
