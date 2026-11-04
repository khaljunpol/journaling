// Points for one day, and the level maths. Pure. Relative imports only.
import { appDay } from './timeZone.ts';
import { categoryOf, type HabitCategory } from './habitCategory.ts';
import type { HabitLog } from './overviewStats.ts';
import { templateKind } from './quickDay.ts';
import { addDaysISO } from './quickWeek.ts';

/** Per good habit ticked, once per habit per day. */
export const HABIT_POINTS = 10;
/** Every good habit on the day's usual list is done. */
export const PERFECT_POINTS = 25;
/** Habits a day that count, so a day's max is 125. */
export const DAILY_CAP = 10;
export const MAX_DAY = DAILY_CAP * HABIT_POINTS + PERFECT_POINTS;
/** A day logged up to this many days late still earns full points. Same limit as GRACE_DAYS and stampTime. */
export const LATE_DAYS = 7;
/** Rules version, written on each locked row. New values never touch old days. */
export const RULES_V = 1;

export type GoodCategory = Exclude<HabitCategory, 'bad'>;
export type DayScore = {
  date: string;
  points: number;
  /** Usual-list habits done, and the list size. */
  done: number;
  total: number;
  perfect: boolean;
  /** Habit points per category (the perfect bonus is not split). */
  byCat: Record<GoodCategory, number>;
};
type Act = { id: string; name: string; category?: HabitCategory };
type Templates = { weekday: string[] | null; weekend: string[] | null };

const emptyCats = (): Record<GoodCategory, number> => ({ move: 0, wellbeing: 0, mind: 0, people: 0, other: 0 });

/** The day's usual list: good habits that still exist. Empty list (or only bad ones) = every good habit. */
export function usualList(date: string, templates: Templates, activities: Act[]): string[] {
  const good = activities.filter((a) => categoryOf(a) !== 'bad').map((a) => a.id);
  const goodSet = new Set(good);
  const listed = [...new Set((templates[templateKind(date)] ?? []).filter((id) => goodSet.has(id)))];
  return listed.length ? listed : good;
}

/** One day's points. `firstHabitStamp`: when the habits were first logged (ISO), or null = on time. */
export function scoreDay(args: {
  date: string;
  logs: HabitLog[];
  activities: Act[];
  templates: Templates;
  firstHabitStamp: string | null;
  filled: boolean;
}): DayScore {
  const { date, logs, activities, templates, firstHabitStamp, filled } = args;
  const list = usualList(date, templates, activities);
  const empty: DayScore = { date, points: 0, done: 0, total: list.length, perfect: false, byCat: emptyCats() };

  const byId = new Map(activities.map((a) => [a.id, a]));
  const doneIds = new Set<string>();
  for (const l of logs) {
    if (l.date.slice(0, 10) !== date || !l.completed) continue;
    const a = byId.get(l.activityId);
    if (a && categoryOf(a) !== 'bad') doneIds.add(a.id);
  }
  const listDone = list.filter((id) => doneIds.has(id)).length;
  const late = firstHabitStamp !== null && appDay(new Date(firstHabitStamp)) > addDaysISO(date, LATE_DAYS);
  if (late) return { ...empty, done: listDone };

  const byCat = emptyCats();
  const counted = activities.filter((a) => doneIds.has(a.id)).slice(0, DAILY_CAP);
  for (const a of counted) byCat[categoryOf(a) as GoodCategory] += HABIT_POINTS;
  const perfect = !filled && list.length > 0 && listDone === list.length;
  return { date, points: counted.length * HABIT_POINTS + (perfect ? PERFECT_POINTS : 0), done: listDone, total: list.length, perfect, byCat };
}

/** The cost of going from `level` to the next one. */
const costOf = (level: number) => 50 * (level + 2);

/** Level from total points. Level 1 starts at 0. */
export function levelFor(total: number): { level: number; into: number; toNext: number; cost: number } {
  let level = 1;
  let left = Math.max(0, Math.floor(total));
  while (left >= costOf(level)) {
    left -= costOf(level);
    level += 1;
  }
  return { level, into: left, toNext: costOf(level) - left, cost: costOf(level) };
}

/**
 * What one Done on the habits card adds: the change in that day's points, and whether it just became perfect.
 * The first log of a day is stamped now, so a day 8+ days old earns nothing, the same as the ledger.
 */
export function rewardFor(args: {
  date: string;
  today: string;
  before: HabitLog[];
  after: HabitLog[];
  activities: Act[];
  templates: Templates;
  stamps: Array<{ date: string; kind: string; at: string }>;
}): { points: number; perfect: boolean } {
  const { date, today, before, after, activities, templates, stamps } = args;
  // Older than the open window: the day is closed, so no edit changes its points.
  if (date < addDaysISO(today, -LATE_DAYS)) return { points: 0, perfect: false };
  const own = stamps.filter((s) => s.date === date && s.kind === 'habits').map((s) => s.at).sort()[0] ?? null;
  // No stamp: on time if the day already had rows; a first log is stamped today.
  const stamp = own ?? (before.length ? null : `${today}T12:00:00.000Z`);
  const score = (logs: HabitLog[]) => scoreDay({ date, logs, activities, templates, firstHabitStamp: stamp, filled: false });
  const a = score(before);
  const b = score(after);
  return { points: b.points - a.points, perfect: b.perfect && !a.perfect };
}
