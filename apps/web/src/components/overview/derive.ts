// Turns the API payloads into the numbers the Overview questions show. Numbers only: the copy lives in the UI.
// Pure maths is in lib/overviewStats.ts; this file joins the sources (dashboard, Today, 90-day reads).
// Value imports stay relative with .ts so tests/derive.test.ts can load it with node --test.
import { lastDates } from '@journaling/core/overview';
import {
  avgKnown,
  bestStreak,
  climbRows,
  climbWeek,
  dailySeries,
  daySpan,
  findSleepIds,
  habitDays,
  habitRate,
  habitStreakGrace,
  lastHighlight,
  monthAgo,
  moodSplit,
  moodWeek,
  sleepNights,
  timeCompare,
  weekWindow,
  type HabitLog,
  type HourRow,
  type MoodRow,
  type TimeRow,
} from '@journaling/core/overviewStats';
import type { QuickPayload } from '@journaling/core/quickPayload';
import { addDaysISO } from '@journaling/core/quickWeek';
import { MIN_PAIRS, MIN_SIDE, SLEEP_CUT } from '@journaling/core/insights';
import { goodIds } from '@journaling/core/habitCategory';
import { keepingUp, type KeepingUp } from '@journaling/core/keepingUp';
import { weekRecap, type WeekRecap } from '@journaling/core/weekRecap';
import type { Activity, MoodItem, Sidequest } from '@journaling/core/types';
import type { HabitRow } from './TrendTable';

export type DashboardData = {
  dates?: {
    todayISO?: string;
    weekFromISO?: string;
    weekToISO?: string;
    prevWeekFromISO?: string;
    prevWeekToISO?: string;
  };
  activities?: Activity[];
  logs30?: HabitLog[];
  highlights30?: Array<{ date: string; text: string }>;
  moods7?: MoodItem[];
  moodsPrev7?: MoodItem[];
  timeCategories?: Array<{ id: string; name: string; color: string }>;
  timeY?: HourRow[];
  climbY?: Array<{ date: string; type: string; grade: string; session?: number }>;
  climb30?: Array<{ date: string; type: string; grade: string; session?: number }>;
  goals?: Array<{ year: number; type: string; grade: string; target: number }>;
  sidequests?: Sidequest[];
};

/** The sleep cut-off, from the one insight rule set. */
export { SLEEP_CUT };

export type OverviewView = {
  mood: {
    avg: number | null;
    prevAvg: number | null;
    /** this week minus last week (same days); null when either side has no mood */
    delta: number | null;
    sleepAvg: number | null;
    bars: Array<{ date: string; value: number | null; thisWeek: boolean }>;
    sheet: {
      hasSleep: boolean;
      split: { hi: number; lo: number; nHi: number; nLo: number } | null;
      nights: Array<{ date: string; hours: number | null }>;
    };
  } | null;
  habits: {
    rate: number | null;
    /** 14-day % minus the 14 days before; null when nothing was logged before */
    delta: number | null;
    streak: number;
    best: number;
    bars: Array<{ date: string; share: number; done: number; active: number }>;
    table: HabitRow[];
    count: number;
  } | null;
  time: {
    top: { name: string; hours: number; delta: number } | null;
    rows: TimeRow[];
    other: { hours: number; prev: number } | null;
    all: TimeRow[];
    total: number;
    /** hours were logged this week, but only sleep (which Q1 shows) */
    sleepOnly: boolean;
  } | null;
  remember: {
    /** false until the dashboard or Today data is here */
    ready: boolean;
    highlight: { date: string; text: string } | null;
    /** failed = the read failed with no cache: the UI makes no claim about that day */
    monthAgo: { date: string; loaded: boolean; failed: boolean; mood: number | null; text: string | null };
  };
  /** null = no climbing logs this year or in the last 30 days (or still loading: check hasDash) */
  climb: { sessions: number; last: string | null; daysSince: number | null } | null;
  quests: { active: number } | null;
  /** null = nothing logged last week, or the data is still loading (check hasDash) */
  recap: WeekRecap | null;
  /** null = no tracked day has finished yet, or the data is still loading */
  keeping: KeepingUp | null;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Hour rows from the dashboard (this year) and the January tail, with Today's days (incl. unsent taps) on top. */
function mergeHours(dash: DashboardData | null, tail: HourRow[] | null, quick: QuickPayload | null): HourRow[] {
  const own = new Set(quick ? Object.keys(quick.days) : []);
  const out: HourRow[] = [];
  for (const h of [...(tail ?? []), ...(dash?.timeY ?? [])]) if (!own.has(h.date.slice(0, 10))) out.push(h);
  if (quick) {
    for (const d of Object.values(quick.days)) {
      d.hours.forEach((c, hour) => { if (c !== null) out.push({ date: d.date, hour, category: c }); });
    }
  }
  return out;
}

/** One mood per date: 90-day read, then the dashboard rows, then Today's days on top (unsent taps). */
function mergeMoods(moods90: MoodItem[] | null, dash: DashboardData | null, quick: QuickPayload | null): MoodRow[] {
  const by = new Map<string, number>();
  for (const m of [...(moods90 ?? []), ...(dash?.moodsPrev7 ?? []), ...(dash?.moods7 ?? [])]) {
    const s = Number(m.score);
    if (Number.isFinite(s) && String(m.score).trim() !== '') by.set(m.date.slice(0, 10), s);
  }
  if (quick) for (const d of Object.values(quick.days)) if (d.mood !== null) by.set(d.date, d.mood);
  return [...by].map(([date, score]) => ({ date, score }));
}

/** Habit rows: the long history (or the dashboard's 30 days), Today's days replace the dates they hold. */
function mergeLogs(history: HabitLog[] | null, dash: DashboardData | null, quick: QuickPayload | null): HabitLog[] {
  const own = new Set(quick ? Object.keys(quick.days) : []);
  const out = (history ?? dash?.logs30 ?? []).filter((l) => !own.has(l.date.slice(0, 10)));
  if (quick) for (const d of Object.values(quick.days)) for (const l of d.logs) out.push({ date: d.date, activityId: l.activityId, completed: l.completed });
  return out;
}

export function deriveOverview(args: {
  today: string;
  dash: DashboardData | null;
  quick: QuickPayload | null;
  history?: HabitLog[] | null;
  moods90?: MoodItem[] | null;
  hoursTail?: HourRow[] | null;
  remember?: QuickPayload | null;
  /** the month-ago read failed and there is no cached copy */
  rememberFailed?: boolean;
}): OverviewView {
  const { today, dash, quick } = args;
  const w = weekWindow(today);
  const dates14 = lastDates(today, 14);
  const dates90 = lastDates(today, 90);
  const weekDates = dates14.filter((d) => d >= w.from);
  const cats = dash?.timeCategories ?? [];
  const sleepIds = findSleepIds(cats);
  const hours = mergeHours(dash, args.hoursTail ?? null, quick);

  // Habits first: the mood fallback link needs the good-day map.
  const activeList = quick ? quick.ctx.activities : (dash?.activities ?? []);
  const activeIds = goodIds(activeList);
  const logs = mergeLogs(args.history ?? null, dash, quick);

  let habits: OverviewView['habits'] = null;
  if (dash || quick) {
    const days14 = habitDays(logs, activeIds, dates14);
    const prevDates = lastDates(addDaysISO(today, -14), 14);
    const prev14 = habitDays(logs, activeIds, prevDates);
    const rate = habitRate(days14);
    const prevRate = habitRate(prev14);
    const loggedBefore = logs.some((l) => l.completed && l.date >= prevDates[0] && l.date <= prevDates[13]);
    // Streak days: from the oldest habit row (the history reaches back to 1 Jan last year).
    let first = dates14[0];
    for (const l of logs) if (l.date < first) first = l.date.slice(0, 10);
    const all = habitDays(logs, activeIds, daySpan(first, today, `${Number(today.slice(0, 4)) - 1}-01-01`));
    const doneSet = new Set(logs.filter((l) => l.completed).map((l) => `${l.date.slice(0, 10)}|${l.activityId}`));
    habits = {
      rate,
      delta: rate !== null && prevRate !== null && loggedBefore ? rate - prevRate : null,
      streak: activeIds.size ? habitStreakGrace(all, new Set(logs.map((l) => l.date.slice(0, 10))), today).streak : 0,
      best: activeIds.size ? bestStreak(all.filter((d) => d.date >= `${today.slice(0, 4)}-01-01`), today) : 0,
      bars: days14.map((d) => ({ date: d.date, share: d.share, done: d.done, active: d.active })),
      table: activeList.filter((a) => activeIds.has(a.id)).map((a) => {
        const flags = dates14.map((date) => doneSet.has(`${date}|${a.id}`));
        return { id: a.id, name: a.name, days: flags, pct: Math.round((flags.filter(Boolean).length / flags.length) * 100) };
      }),
      count: activeIds.size,
    };
  }

  // Mood + sleep.
  let mood: OverviewView['mood'] = null;
  if (dash || quick || args.moods90) {
    const moods = mergeMoods(args.moods90 ?? null, dash, quick);
    const mw = moodWeek(moods, today);
    const hasSleep = sleepIds.size > 0;
    const sleepAvg = hasSleep ? avgKnown(sleepNights(hours, sleepIds, weekDates, today)) : null;

    // The mood sheet's sleep split uses the Insights rules (14 days, 5 on each side).
    const sleepSide = new Map<string, boolean>();
    if (hasSleep) for (const n of sleepNights(hours, sleepIds, dates90, today)) if (n.hours !== null) sleepSide.set(n.date, n.hours >= SLEEP_CUT);
    const sleepSplit = hasSleep ? moodSplit(moods, sleepSide, today, { pairs: MIN_PAIRS, side: MIN_SIDE }) : null;

    mood = {
      avg: mw.avg,
      prevAvg: mw.prevAvg,
      delta: mw.avg !== null && mw.prevAvg !== null ? round1(mw.avg - mw.prevAvg) : null,
      sleepAvg,
      bars: dailySeries(moods, today, 14).map((p) => ({ ...p, thisWeek: p.date >= w.from })),
      sheet: {
        hasSleep,
        split: sleepSplit ? { hi: sleepSplit.hi, lo: sleepSplit.lo, nHi: sleepSplit.nHi, nLo: sleepSplit.nLo } : null,
        nights: hasSleep ? sleepNights(hours, sleepIds, dates14, today) : dates14.map((date) => ({ date, hours: null })),
      },
    };
  }

  // Time: this week vs the same days last week.
  let time: OverviewView['time'] = null;
  if (dash) {
    // Sleep has its own line in Q1, so the answer and chart leave it out; the Time sheet keeps every category.
    const t = timeCompare(hours.filter((h) => !sleepIds.has(String(h.category))), cats, today, 5);
    const every = timeCompare(hours, cats, today, 5);
    time = { top: t.top, rows: t.rows, other: t.other, all: every.all, total: t.total, sleepOnly: t.total === 0 && every.total > 0 };
  }

  // Remember: last highlight (dashboard 30 days + Today's days) and the same day a month ago.
  const ownDays = new Set(quick ? Object.keys(quick.days) : []);
  const hl = (dash?.highlights30 ?? []).filter((h) => !ownDays.has(h.date.slice(0, 10)));
  if (quick) for (const d of Object.values(quick.days)) hl.push({ date: d.date, text: d.highlight });
  const ago = monthAgo(today);
  const agoDay = args.remember?.days?.[ago] ?? null;
  const remember: OverviewView['remember'] = {
    ready: dash !== null || quick !== null,
    highlight: lastHighlight(hl, today, 30),
    monthAgo: {
      date: ago,
      loaded: args.remember != null,
      failed: args.remember == null && args.rememberFailed === true,
      mood: agoDay?.mood ?? null,
      text: agoDay && agoDay.highlight.trim() ? agoDay.highlight.trim() : null,
    },
  };

  const climbs = climbRows(dash?.climbY ?? [], dash?.climb30 ?? [], today);
  const climb = climbs.length ? climbWeek(climbs, today) : null;
  const quests = dash?.sidequests ? { active: dash.sidequests.filter((s) => !s.completedAt).length } : null;

  // Needs every source: a recap from part of the data would show wrong numbers.
  const recap = dash && quick && args.moods90
    ? weekRecap({
        today,
        moods: mergeMoods(args.moods90, dash, quick),
        hours,
        logs,
        cats,
        activeIds,
        activities: activeList,
        weights: Object.values(quick.days).filter((d) => d.weight !== null),
        stamps: quick.stamps,
      })
    : null;

  // Weight has no 30-day read here, so its stamps stand in for it. Tracked days always have one.
  let keeping: KeepingUp | null = null;
  if (dash && quick && args.moods90) {
    const stamps = quick.stamps ?? [];
    const has = new Set(stamps.map((s) => `${s.date}|${s.kind}`));
    const add = (date: string, kind: string) => has.add(`${date.slice(0, 10)}|${kind}`);
    for (const m of mergeMoods(args.moods90, dash, quick)) add(m.date, 'mood');
    for (const l of logs) add(l.date, 'habits');
    for (const h of hours) add(h.date, 'hours');
    for (const d of Object.values(quick.days)) if (d.weight !== null) add(d.date, 'weight');
    keeping = keepingUp({ today, stamps, hasPart: (date, kind) => has.has(`${date}|${kind}`) });
  }

  return { mood, habits, time, remember, climb, quests, recap, keeping };
}
