// Insights: what goes with a better mood, where habits go, the week's rhythm. One rule set for the app,
// the weekly recap and the widget. Pure. Relative imports only. Days before TRACKING_START count here.
import { categoryOf, type HabitCategory } from './habitCategory.ts';
import { lastDates } from './overview.ts';
import { findSleepIds, moodSplit, sleepNights, type Cat, type HabitLog, type HourRow, type MoodRow } from './overviewStats.ts';
import { addDaysISO } from './quickWeek.ts';

/** Days looked back over. */
export const WINDOW = 180;
/** Paired days needed, and days on each side. */
export const MIN_PAIRS = 14;
export const MIN_SIDE = 5;
/** Smallest mood gap worth saying. */
export const MIN_GAP = 0.5;
/** The sleep cut-off (default: 7h). */
export const SLEEP_CUT = 7;
/** A smaller week-on-week mood change reads as "about the same". */
export const SAME = 0.3;
/** Mood days a weekday needs before it is named. */
export const WEEKDAY_MIN = 4;
/** Hours a day needs logged before it can be a time side. */
export const DAY_HOURS_MIN = 20;

export type InsightInput = {
  today: string;
  moods: MoodRow[];
  hours: HourRow[];
  logs: HabitLog[];
  activities: Array<{ id: string; name: string; category?: HabitCategory }>;
  cats: Array<Cat & { group?: string }>;
};

export type Finding = {
  kind: 'habit' | 'sleep' | 'time';
  /** Habit id, 'sleep', or time category id. */
  id: string;
  /** Habit name, '7h+ sleep', or category name. */
  name: string;
  /** Time only: the median hours, the cut between the sides. */
  cut?: number;
  /** A habit in the Bad habits category. */
  bad?: boolean;
  hi: number;
  lo: number;
  nHi: number;
  nLo: number;
  /** hi - lo, one decimal. Negative = mood is lower on the high side. */
  gap: number;
};

const day = (iso: string) => iso.slice(0, 10);
type Side = { kind: Finding['kind']; id: string; name: string; cut?: number; bad?: boolean; by: Map<string, boolean> };

/** First date each habit has any row (done or not), up to today. Days before it, the habit did not exist yet. */
export function firstSeen(logs: HabitLog[], today: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const l of logs) {
    const d = day(l.date);
    if (d > today) continue;
    const f = out.get(l.activityId);
    if (!f || d < f) out.set(l.activityId, d);
  }
  return out;
}

/** Biggest gap first, ties by more days. */
export function rankFindings(fs: Finding[]): Finding[] {
  return [...fs].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || b.nHi + b.nLo - (a.nHi + a.nLo));
}

/** Habit and time sides over the window. Sleep is added only when `withSleep`. */
function sides(input: InsightInput, withSleep: boolean): Side[] {
  const { today, hours, logs, activities, cats } = input;
  const dates = lastDates(today, WINDOW);
  const from = dates[0];
  const inWindow = (d: string) => d >= from && d <= today;
  const out: Side[] = [];

  // Habits: done vs not done, on days with any row for a known habit, from the habit's first row. Blank days drop out.
  const first = firstSeen(logs, today);
  const known = new Map(activities.map((a) => [a.id, a]));
  const logged = new Set<string>();
  const doneOn = new Map<string, Set<string>>();
  for (const l of logs) {
    const d = day(l.date);
    if (!inWindow(d) || !known.has(l.activityId)) continue;
    logged.add(d);
    if (!l.completed) continue;
    const s = doneOn.get(l.activityId) ?? new Set<string>();
    s.add(d);
    doneOn.set(l.activityId, s);
  }
  for (const a of activities) {
    const s = doneOn.get(a.id) ?? new Set<string>();
    const start = first.get(a.id);
    if (!start) continue;
    const days = [...logged].filter((d) => d >= start);
    out.push({ kind: 'habit', id: a.id, name: a.name, bad: categoryOf(a) === 'bad' || undefined, by: new Map(days.map((d) => [d, s.has(d)])) });
  }

  const sleepIds = findSleepIds(cats);
  if (withSleep && sleepIds.size) {
    const by = new Map<string, boolean>();
    for (const n of sleepNights(hours, sleepIds, dates, today)) if (n.hours !== null) by.set(n.date, n.hours >= SLEEP_CUT);
    out.push({ kind: 'sleep', id: 'sleep', name: `${SLEEP_CUT}h+ sleep`, by });
  }

  // Time: hours per day per category, on days with DAY_HOURS_MIN+ hours logged. Sleep left out.
  const slots = new Map<string, Map<number, string>>();
  for (const h of hours) {
    const d = day(h.date);
    if (!inWindow(d)) continue;
    const m = slots.get(d) ?? new Map<number, string>();
    m.set(h.hour, String(h.category));
    slots.set(d, m);
  }
  const fullDays = [...slots].filter(([, m]) => m.size >= DAY_HOURS_MIN);
  for (const c of cats) {
    const id = String(c.id);
    if (sleepIds.has(id)) continue;
    const per = fullDays.map(([d, m]) => [d, [...m.values()].filter((v) => v === id).length] as const);
    if (!per.some(([, n]) => n > 0)) continue;
    const sorted = per.map(([, n]) => n).sort((a, b) => a - b);
    const mid = sorted.length / 2;
    const cut = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (cut <= 0) continue;
    out.push({ kind: 'time', id, name: c.name, cut, by: new Map(per.map(([d, n]) => [d, n >= cut])) });
  }
  return out;
}

function findings(input: InsightInput, list: Side[]): Finding[] {
  const out: Finding[] = [];
  for (const s of list) {
    const r = moodSplit(input.moods, s.by, input.today, { pairs: MIN_PAIRS, side: MIN_SIDE });
    if (!r) continue;
    const se = Math.sqrt(r.sdHi ** 2 / r.nHi + r.sdLo ** 2 / r.nLo);
    const gap = Math.round((r.hi - r.lo) * 10) / 10;
    if (Math.abs(r.diff) < MIN_GAP || Math.abs(r.diff) < 2 * se) continue;
    const f: Finding = { kind: s.kind, id: s.id, name: s.name, hi: r.hi, lo: r.lo, nHi: r.nHi, nLo: r.nLo, gap };
    if (s.cut !== undefined) f.cut = s.cut;
    if (s.bad) f.bad = true;
    out.push(f);
  }
  return rankFindings(out);
}

/** Habits, sleep and time that go with a higher or lower mood on the same day. */
export function lifts(input: InsightInput): Finding[] {
  return findings(input, sides(input, true));
}

/** Habits and time on day D against mood on D+1. Sleep is left out: it already pairs with the morning after. */
export function nextDay(input: InsightInput): Finding[] {
  const moved = sides(input, false).map((s) => ({ ...s, by: new Map([...s.by].map(([d, v]) => [addDaysISO(d, 1), v])) }));
  return findings(input, moved);
}

type GoodCategory = Exclude<HabitCategory, 'bad'>;
const GOOD_CATS: GoodCategory[] = ['move', 'wellbeing', 'mind', 'people', 'other'];
/** Checks and weeks "Where your habits go" needs. */
const GO_MIN_CHECKS = 20;
const GO_MIN_WEEKS = 2;
const GO_WEEKS = 12;

export type HabitsGo = {
  /** Last 4 weeks. delta: % points against the 4 weeks before, null when that has no checks. */
  top: { category: HabitCategory; pct: number; delta: number | null };
  /** 12 weeks, oldest first, each from its Monday. Good habits only. */
  weeks: Array<{ from: string; counts: Record<GoodCategory, number> }>;
  /** Last 4 weeks, most checks first. Good habits only. */
  byCategory: Array<{ category: HabitCategory; habits: Array<{ id: string; name: string; done: number }> }>;
  /** Days with any bad habit ticked. null when no habit is bad. */
  bad: { thisWeek: number; lastWeek: number } | null;
};

export type WeekRhythm = {
  best: { day: string; avg: number };
  low: { day: string; avg: number };
  /** Monday first. */
  mood: Array<{ day: string; avg: number | null; n: number }>;
  /** Share of good habits done, on logged days only. Monday first. */
  habits: Array<{ day: string; pct: number | null }>;
};

export type Insights = {
  lifts: Finding[];
  nextDay: Finding[];
  habitsGo: HabitsGo | null;
  rhythm: WeekRhythm | null;
  /** Mood days still needed when no mood answer shows; 0 when one shows. */
  moreDays: number;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** 0 = Monday. Read as UTC noon so the weekday never shifts. */
const weekday = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const mondayOfISO = (d: string) => addDaysISO(d, -weekday(d));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const emptyCounts = (): Record<GoodCategory, number> => ({ move: 0, wellbeing: 0, mind: 0, people: 0, other: 0 });
const validMood = (m: MoodRow) => String(m.score).trim() !== '' && Number.isFinite(Number(m.score));

/** Unique done (date, habit) pairs for known habits, up to today. */
function checks(input: InsightInput): Array<{ date: string; id: string }> {
  const known = new Set(input.activities.map((a) => a.id));
  const seen = new Set<string>();
  const out: Array<{ date: string; id: string }> = [];
  for (const l of input.logs) {
    const d = day(l.date);
    if (!l.completed || !known.has(l.activityId) || d > input.today) continue;
    const k = `${d}|${l.activityId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ date: d, id: l.activityId });
  }
  return out;
}

/** Where your habits go: shares by category, 12 weekly bars, and bad habits as a plain day count. */
export function habitsGo(input: InsightInput): HabitsGo | null {
  const { today, activities } = input;
  const catOf = new Map(activities.map((a) => [a.id, categoryOf(a)]));
  const all = checks(input);
  const good = all.filter((c) => catOf.get(c.id) !== 'bad');
  const thisMonday = mondayOfISO(today);
  const firstMonday = addDaysISO(thisMonday, -7 * (GO_WEEKS - 1));
  const inRange = good.filter((c) => c.date >= firstMonday);
  if (inRange.length < GO_MIN_CHECKS || new Set(inRange.map((c) => mondayOfISO(c.date))).size < GO_MIN_WEEKS) return null;

  const last4From = addDaysISO(today, -27);
  const prevFrom = addDaysISO(today, -55);
  const share = (rows: typeof good) => {
    const by = emptyCounts();
    for (const c of rows) by[catOf.get(c.id) as GoodCategory] += 1;
    return { by, total: rows.length };
  };
  const cur = share(good.filter((c) => c.date >= last4From));
  const prev = share(good.filter((c) => c.date >= prevFrom && c.date < last4From));
  if (cur.total === 0) return null;
  const topCat = GOOD_CATS.reduce((a, b) => (cur.by[b] > cur.by[a] ? b : a));
  const pct = Math.round((cur.by[topCat] / cur.total) * 100);
  const delta = prev.total ? pct - Math.round((prev.by[topCat] / prev.total) * 100) : null;

  const weeks = Array.from({ length: GO_WEEKS }, (_, i) => ({ from: addDaysISO(firstMonday, 7 * i), counts: emptyCounts() }));
  for (const c of inRange) weeks[Math.floor(daysBetween(firstMonday, c.date) / 7)].counts[catOf.get(c.id) as GoodCategory] += 1;

  const perHabit = new Map<string, number>();
  for (const c of good) if (c.date >= last4From) perHabit.set(c.id, (perHabit.get(c.id) ?? 0) + 1);
  const total = (c: { habits: Array<{ done: number }> }) => c.habits.reduce((s, h) => s + h.done, 0);
  const byCategory = GOOD_CATS.map((category) => ({
    category: category as HabitCategory,
    habits: activities
      .filter((a) => catOf.get(a.id) === category && perHabit.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, done: perHabit.get(a.id) as number }))
      .sort((a, b) => b.done - a.done),
  }))
    .filter((c) => c.habits.length)
    .sort((a, b) => total(b) - total(a));

  const hasBad = activities.some((a) => catOf.get(a.id) === 'bad');
  const badDays = (from: string, to: string) => new Set(all.filter((c) => catOf.get(c.id) === 'bad' && c.date >= from && c.date <= to).map((c) => c.date)).size;
  const bad = hasBad ? { thisWeek: badDays(thisMonday, today), lastWeek: badDays(addDaysISO(thisMonday, -7), addDaysISO(thisMonday, -1)) } : null;

  return { top: { category: topCat, pct, delta }, weeks, byCategory, bad };
}

/** Best and lowest mood weekday over the window, with the habit share per weekday. */
export function weekRhythm(input: InsightInput): WeekRhythm | null {
  const { today, moods, activities, logs } = input;
  const from = addDaysISO(today, -(WINDOW - 1));
  const byDate = new Map<string, { s: number; n: number }>();
  for (const m of moods) {
    const d = day(m.date);
    if (d < from || d > today || !validMood(m)) continue;
    const e = byDate.get(d) ?? { s: 0, n: 0 };
    e.s += Number(m.score);
    e.n += 1;
    byDate.set(d, e);
  }
  const sums = DAYS.map(() => ({ s: 0, n: 0 }));
  for (const [d, e] of byDate) {
    sums[weekday(d)].s += e.s / e.n;
    sums[weekday(d)].n += 1;
  }
  const mood = DAYS.map((d, i) => ({ day: d, avg: sums[i].n ? Math.round((sums[i].s / sums[i].n) * 10) / 10 : null, n: sums[i].n }));
  const named = mood.filter((m): m is { day: string; avg: number; n: number } => m.n >= WEEKDAY_MIN && m.avg !== null);
  if (named.length < 2) return null;
  const best = named.reduce((a, b) => (b.avg > a.avg ? b : a));
  const low = named.reduce((a, b) => (b.avg < a.avg ? b : a));
  if (best.avg - low.avg < 1) return null;

  const goodSet = new Set(activities.filter((a) => categoryOf(a) !== 'bad').map((a) => a.id));
  const known = new Set(activities.map((a) => a.id));
  const loggedDays = new Set<string>();
  for (const l of logs) {
    const d = day(l.date);
    if (d >= from && d <= today && known.has(l.activityId)) loggedDays.add(d);
  }
  const first = firstSeen(logs, today);
  const hab = DAYS.map(() => ({ done: 0, days: 0 }));
  // `days` counts habit-days: each logged day adds the good habits that existed by then.
  for (const d of loggedDays) hab[weekday(d)].days += [...goodSet].filter((id) => (first.get(id) ?? '9') <= d).length;
  for (const c of checks(input)) if (goodSet.has(c.id) && loggedDays.has(c.date)) hab[weekday(c.date)].done += 1;
  const habits = DAYS.map((d, i) => ({ day: d, pct: hab[i].days ? Math.round((hab[i].done / hab[i].days) * 100) : null }));

  return { best: { day: best.day, avg: best.avg }, low: { day: low.day, avg: low.avg }, mood, habits };
}

/** Every answer the Insights tab shows. */
export function insights(input: InsightInput): Insights {
  const l = lifts(input);
  const n = nextDay(input);
  const rhythm = weekRhythm(input);
  const from = addDaysISO(input.today, -(WINDOW - 1));
  const moodDays = new Set(input.moods.filter((m) => validMood(m) && day(m.date) >= from && day(m.date) <= input.today).map((m) => day(m.date))).size;
  const moreDays = l.length || n.length || rhythm ? 0 : Math.max(0, MIN_PAIRS - moodDays);
  return { lifts: l, nextDay: n, habitsGo: habitsGo(input), rhythm, moreDays };
}

/** Plain sentence for a finding, no full stop. `next`: the next-day form. */
export function insightLine(f: Finding, next = false): string {
  const what = f.kind === 'time' ? `${f.cut}h+ ${f.name}` : f.name;
  const tail = `mood is ${Math.abs(f.gap)} ${f.gap >= 0 ? 'higher' : 'lower'}`;
  if (next) return `The day after ${what}, ${tail}`;
  if (f.kind === 'habit') return `On days when ${f.name} is done, ${tail}`;
  if (f.kind === 'sleep') return `On days after ${f.name}, ${tail}`;
  return `On days with ${what}, ${tail}`;
}
