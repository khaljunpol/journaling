// Pure week and catch-up logic for /quick. Dates are local YYYY-MM-DD strings; math uses UTC parts so DST cannot shift a day.
import type { ItemKey } from './quickDay.ts';
import type { HabitCategory } from './habitCategory.ts';
import { applyTemplate, initialTicks, templateKind } from './quickDay.ts';

const p2 = (n: number) => String(n).padStart(2, '0');

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

/** Monday of the week that holds `iso`. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysISO(iso, dow === 0 ? -6 : 1 - dow);
}

/** Mon..Sun for a Monday. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

/** What to fetch for a shown week: Monday to Sunday, but never past today. */
export function weekRange(monday: string, today: string): { from: string; to: string } {
  const sunday = addDaysISO(monday, 6);
  return { from: monday, to: sunday < today ? sunday : today };
}

/** Move by whole weeks. Never lands after the current week. */
export function shiftWeek(monday: string, weeks: number, today: string): string {
  const next = addDaysISO(monday, weeks * 7);
  const current = mondayOf(today);
  return next > current ? current : next;
}

export function canGoNext(monday: string, today: string): boolean {
  return monday < mondayOf(today);
}

export function datesUpTo(dates: string[], today: string): string[] {
  return dates.filter((d) => d <= today);
}

// ---- Catch-up choice ----

export const CATCHUP_KINDS: ItemKey[] = ['mood', 'habits', 'weight', 'sidequests', 'hours', 'highlight'];
/** The kinds that close a day by default (same as dayStatus without a choice). */
export const DAILY_KINDS: ItemKey[] = ['mood', 'habits', 'weight', 'hours'];

/** A stored choice as a clean list, in card order. Anything that is not a list gives the daily kinds. */
export function sanitizeChoice(v: unknown): ItemKey[] {
  if (!Array.isArray(v)) return [...DAILY_KINDS];
  return CATCHUP_KINDS.filter((k) => v.includes(k));
}

export function toggleKind(choice: ItemKey[], key: ItemKey): ItemKey[] {
  const has = choice.includes(key);
  return CATCHUP_KINDS.filter((k) => (k === key ? !has : choice.includes(k)));
}

/** Days before yesterday count only the chosen kinds. Yesterday, today and later count everything (undefined). */
export function onlyFor(date: string, yesterday: string, choice: ItemKey[]): ItemKey[] | undefined {
  return date < yesterday ? choice : undefined;
}

export type CatchUpStep = { date: string; key: ItemKey };

/** Cards for a catch-up run: oldest day first, only chosen kinds, never past today. */
export function catchUpSteps(
  days: Array<{ date: string; missing: ItemKey[] }>,
  today: string,
  choice: ItemKey[],
): CatchUpStep[] {
  return days
    .filter((d) => d.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .flatMap((d) => d.missing.filter((k) => choice.includes(k)).map((key) => ({ date: d.date, key })));
}

// ---- Hours from templates ----

export type TemplateFillPlan = {
  fills: Array<{ date: string; hours: Array<number | null> }>;
  missingKinds: Array<'weekday' | 'weekend'>;
  /** Days left alone because they already have an hour set. */
  skippedHasHours: number;
};

/** Which days get template hours: up to today, hours all empty, template present. Days with any hour are never touched. */
export function templateFillPlan(
  days: Array<{ date: string; hours: Array<number | null> }>,
  today: string,
  templates: { weekday: Array<number | null> | null; weekend: Array<number | null> | null },
  categoryIds: number[],
): TemplateFillPlan {
  const fills: TemplateFillPlan['fills'] = [];
  const missing = new Set<'weekday' | 'weekend'>();
  let skippedHasHours = 0;
  for (const d of days) {
    if (d.date > today) continue;
    if (d.hours.some((h) => h !== null)) {
      skippedHasHours += 1;
      continue;
    }
    const kind = templateKind(d.date);
    const hours = applyTemplate(templates[kind], categoryIds);
    if (hours.every((h) => h === null)) {
      missing.add(kind);
      continue;
    }
    fills.push({ date: d.date, hours });
  }
  return {
    fills,
    missingKinds: (['weekday', 'weekend'] as const).filter((k) => missing.has(k)),
    skippedHasHours,
  };
}

/** Calm one-liner for the result of a template fill. */
export function templateMessage(plan: TemplateFillPlan): string {
  const n = plan.fills.length;
  const lack =
    plan.missingKinds.length === 2 ? 'No templates yet.' : plan.missingKinds.length === 1 ? `No ${plan.missingKinds[0]} template yet.` : '';
  if (n > 0) return `Filled hours for ${n} ${n === 1 ? 'day' : 'days'}.${lack ? ' ' + lack : ''}`;
  if (lack) return lack;
  return 'Every day already has hours.';
}

// ---- Habits from usual lists ----

export type HabitFillPlan = {
  fills: Array<{ date: string; rows: Array<{ activityId: string; completed: boolean }> }>;
  missingKinds: Array<'weekday' | 'weekend'>;
  /** Days left alone because they already have a habit row. */
  skippedHasLogs: number;
};

/** Which days get their usual habits: up to today, no log rows at all, template has a habit that still exists. */
export function habitFillPlan(
  days: Array<{ date: string; logs: Array<{ activityId: string; completed: boolean }> }>,
  today: string,
  templates: { weekday: string[] | null; weekend: string[] | null },
  activities: Array<{ id: string; name?: string; status?: string; category?: HabitCategory }>,
): HabitFillPlan {
  const fills: HabitFillPlan['fills'] = [];
  const missing = new Set<'weekday' | 'weekend'>();
  const active = activities;
  let skippedHasLogs = 0;
  for (const d of days) {
    if (d.date > today) continue;
    if (d.logs.length > 0) {
      skippedHasLogs += 1;
      continue;
    }
    const kind = templateKind(d.date);
    const { ticked } = initialTicks([], templates[kind], activities);
    if (ticked.size === 0) {
      missing.add(kind);
      continue;
    }
    fills.push({ date: d.date, rows: active.map((a) => ({ activityId: a.id, completed: ticked.has(a.id) })) });
  }
  return {
    fills,
    missingKinds: (['weekday', 'weekend'] as const).filter((k) => missing.has(k)),
    skippedHasLogs,
  };
}

/** Calm one-liner for the result of a habit fill. */
export function habitMessage(plan: HabitFillPlan): string {
  const n = plan.fills.length;
  const lack =
    plan.missingKinds.length === 2
      ? 'No usual habits yet. Set them on Time categories.'
      : plan.missingKinds.length === 1
        ? `No usual ${plan.missingKinds[0]} habits yet. Set them on Time categories.`
        : '';
  if (n > 0) return `Filled habits for ${n} ${n === 1 ? 'day' : 'days'}.${lack ? ' ' + lack : ''}`;
  if (lack) return lack;
  return 'Every day already has habits.';
}
