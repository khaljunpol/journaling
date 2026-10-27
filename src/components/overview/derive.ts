// Turns the two API payloads (/api/dashboard and /api/quick) into the numbers the Overview shows.
// Not pure (it imports insights.ts through the @ alias), so it lives next to the components.
import { computeAttentionSignals, computeMoodActivityCorrelation, computeWeeklySummary } from '@/lib/insights';
import type { Signal } from '@/lib/insights';
import {
  habitScoreSeries,
  lastDates,
  moodAvg7,
  stripBars,
  timeSplit,
  todayFeed,
  trend,
} from '@/lib/overview';
import type { FeedEntry, TimeSlice } from '@/lib/overview';
import type { QuickPayload } from '@/lib/quickPayload';
import { addDaysISO } from '@/lib/quickWeek';
import { dayStatus } from '@/lib/quickDay';
import type { Activity, MoodItem, Sidequest } from '@/lib/types';
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
  logs30?: Array<{ date: string; activityId: string; completed: boolean }>;
  moods7?: MoodItem[];
  moodsPrev7?: MoodItem[];
  metrics?: {
    summary?: { currentStreakDays?: number };
    weeks?: Array<{ date?: string; rate?: number }>;
  } | null;
  timeCategories?: Array<{ id: string; name: string; color: string }>;
  timeY?: Array<{ date: string; hour: number; category: number | string }>;
  climbY?: Array<{ date: string; type: string; grade: string }>;
  goals?: Array<{ year: number; type: string; grade: string; target: number }>;
  sidequests?: Sidequest[];
};

export type OverviewView = {
  ring: { filled: number; total: number } | null;
  mood: { avg: number | null; trendText: string | null; trendDelta: number; series: number[] };
  habit: { score: number | null; trendText: string | null; trendDelta: number; series: number[] } | null;
  climb: { month: number; week: number; trendText: string; trendDelta: number } | null;
  bars: Array<{ date: string; filled: number; total: number }> | null;
  feed: FeedEntry[] | null;
  split: { slices: TimeSlice[]; total: number } | null;
  habits: HabitRow[] | null;
  notes: { summary: string; signals: Signal[]; insight: string | null } | null;
  quests: Sidequest[] | null;
};

const PRODUCTIVE = ['work', 'hobbies / projects', 'exercise / sports', 'chores', 'travel', 'content'];
const REST = ['relaxation / leisure', 'friends', 'wife', 'party', 'brain rot / misc'];

/** Weekly Productive / Rest / Sleep hours (one entry = one hour), by category name. */
export function timeBalance(
  entries: Array<{ category: number | string }>,
  cats: Array<{ id: string; name: string }>,
): { productive: number; rest: number; sleep: number } {
  const idsFor = (names: string[]) =>
    new Set(names.map((n) => cats.find((c) => c.name.toLowerCase() === n)?.id).filter((x): x is string => x !== undefined).map(String));
  const prod = idsFor(PRODUCTIVE);
  const rest = idsFor(REST);
  const sleepId = cats.find((c) => c.name.toLowerCase() === 'sleep')?.id;
  return {
    productive: entries.filter((t) => prod.has(String(t.category))).length,
    rest: entries.filter((t) => rest.has(String(t.category))).length,
    sleep: sleepId === undefined ? 0 : entries.filter((t) => String(t.category) === String(sleepId)).length,
  };
}

function distinctDates(rows: Array<{ date: string }>, from: string, to: string): number {
  return new Set(rows.filter((r) => r.date >= from && r.date <= to).map((r) => r.date)).size;
}

export function deriveOverview(args: {
  today: string;
  dash: DashboardData | null;
  quick: QuickPayload | null;
  history?: Array<{ date: string; activityId: string; completed: boolean }> | null;
  queue: Array<{ key: string; state: 'pending' | 'failed' }>;
}): OverviewView {
  const { today, dash, quick, queue } = args;
  const history = args.history ?? dash?.logs30 ?? [];
  const dates14 = lastDates(today, 14);

  // Ring, strip, feed: the same rule as Today.
  const todayDay = quick?.days[today];
  const ring = quick && todayDay ? (({ filled, total }) => ({ filled, total }))(dayStatus(todayDay, quick.ctx)) : null;
  const bars = quick ? stripBars(quick, dates14) : null;
  const feed = quick && todayDay ? todayFeed(todayDay, quick.ctx, queue) : quick ? [] : null;

  // Mood: dashboard rows first, then Today's data on top (it holds unsent taps).
  const moodByDate = new Map<string, number>();
  for (const m of [...(dash?.moodsPrev7 ?? []), ...(dash?.moods7 ?? [])]) moodByDate.set(m.date, Number(m.score));
  if (quick) for (const d of Object.values(quick.days)) if (d.mood !== null) moodByDate.set(d.date, d.mood);
  const moods = [...moodByDate.entries()].map(([date, score]) => ({ date, score })).sort((a, b) => a.date.localeCompare(b.date));
  const avg = moodAvg7(moods, today);
  const prevAvg = moodAvg7(moods, addDaysISO(today, -7));
  const moodTrend = avg !== null && prevAvg !== null ? trend(avg, prevAvg) : null;
  const from7 = addDaysISO(today, -6);
  const mood = {
    avg,
    trendText: moodTrend?.text ?? null,
    trendDelta: moodTrend?.delta ?? 0,
    series: moods.filter((m) => m.date >= from7 && m.date <= today).map((m) => m.score),
  };

  // Habits: active habits only; Today's logs override the dashboard's for the days it holds.
  const activeList = quick
    ? quick.ctx.activities.filter((a) => a.status !== 'stopped')
    : (dash?.activities ?? []).map((a) => ({ id: a.id, name: a.name }));
  const activeIds = new Set(activeList.map((a) => a.id));
  let habit: OverviewView['habit'] = null;
  let habits: HabitRow[] | null = null;
  if (dash || quick) {
    const done = new Map<string, Set<string>>();
    for (const l of history) {
      if (!l.completed || !activeIds.has(l.activityId)) continue;
      if (!done.has(l.date)) done.set(l.date, new Set());
      done.get(l.date)!.add(l.activityId);
    }
    if (quick) {
      for (const d of Object.values(quick.days)) {
        done.set(d.date, new Set(d.logs.filter((l) => l.completed && activeIds.has(l.activityId)).map((l) => l.activityId)));
      }
    }
    // Full history: the score starts at 0 on the first day that has any habit row.
    let first = today;
    for (const l of history) if (l.date < first) first = l.date;
    if (quick) for (const d of Object.values(quick.days)) if (d.logs.length > 0 && d.date < first) first = d.date;
    const allDays: Array<{ date: string; done: number; active: number }> = [];
    for (let date = first; date <= today && allDays.length < 4000; date = addDaysISO(date, 1)) {
      allDays.push({ date, done: done.get(date)?.size ?? 0, active: activeIds.size });
    }
    const series = habitScoreSeries(allDays);
    const score = series.length ? Math.round(series[series.length - 1]) : null;
    const before = series.length >= 8 ? Math.round(series[series.length - 8]) : null;
    const t = score !== null && before !== null ? trend(score, before) : null;
    habit = { score, trendText: t?.text ?? null, trendDelta: t?.delta ?? 0, series: series.slice(-14) };
    habits = activeList.slice(0, 6).map((a) => {
      const flags = dates14.map((date) => done.get(date)?.has(a.id) ?? false);
      return { id: a.id, name: a.name, days: flags, pct: Math.round((flags.filter(Boolean).length / flags.length) * 100) };
    });
  }

  // Climbing: sessions are distinct days.
  let climb: OverviewView['climb'] = null;
  if (dash?.climbY) {
    const d = dash.dates ?? {};
    const month = distinctDates(dash.climbY, `${today.slice(0, 7)}-01`, today);
    const week = distinctDates(dash.climbY, d.weekFromISO ?? addDaysISO(today, -6), today);
    const last = distinctDates(dash.climbY, d.prevWeekFromISO ?? addDaysISO(today, -13), d.prevWeekToISO ?? addDaysISO(today, -7));
    const t = trend(week, last);
    climb = { month, week, trendText: t.text, trendDelta: t.delta };
  }

  // Time split: last 7 days.
  const split = dash?.timeY && dash.timeCategories ? timeSplit(dash.timeY, dash.timeCategories, from7, today) : null;

  // Notes: the weekly summary, kind signals and the mood/habit link.
  let notes: OverviewView['notes'] = null;
  if (dash) {
    const d = dash.dates ?? {};
    const weeks = dash.metrics?.weeks ?? [];
    const rateOf = (date?: string) => Number(weeks.find((w) => w.date === date)?.rate) || 0;
    const timeY = dash.timeY ?? [];
    const cats = dash.timeCategories ?? [];
    const weekFrom = d.weekFromISO ?? from7;
    const weekTo = d.weekToISO ?? today;
    const week = timeY.filter((t) => t.date >= weekFrom && t.date <= weekTo);
    const balance = timeBalance(week, cats);
    const sessionsThis = climb?.week ?? 0;
    const sessionsLast = dash.climbY
      ? distinctDates(dash.climbY, d.prevWeekFromISO ?? addDaysISO(today, -13), d.prevWeekToISO ?? addDaysISO(today, -7))
      : 0;
    const summary = computeWeeklySummary({
      moodAvg7: avg,
      moodPrevAvg: prevAvg,
      thisWeekRate: rateOf(d.weekFromISO),
      lastWeekRate: rateOf(d.prevWeekFromISO),
      climbSessionsThisWeek: sessionsThis,
      balance,
    });
    const year = Number(today.slice(0, 4));
    const expected = Math.round(((Number(today.slice(5, 7))) / 12) * 100);
    const goalStats = (dash.goals ?? [])
      .filter((g) => Number(g.year) === year)
      .map((g) => {
        const n = (dash.climbY ?? []).filter((c) => c.type === g.type && c.grade === g.grade).length;
        const percent = Math.min(100, Math.round((n / (Number(g.target) || 1)) * 100));
        return { label: `${g.type[0].toUpperCase()}${g.type.slice(1)} ${g.grade}`, percent, onTrack: percent >= expected ? ('on track' as const) : ('behind' as const) };
      });
    const signals = computeAttentionSignals({
      moods7: moods.filter((m) => m.date >= from7 && m.date <= today),
      streakDays: Number(dash.metrics?.summary?.currentStreakDays) || 0,
      climbSessionsThisWeek: sessionsThis,
      climbSessionsLastWeek: sessionsLast,
      goalStats,
      moodAvg7: avg,
      moodPrevAvg: prevAvg,
    });
    const corr = computeMoodActivityCorrelation(moods, dash.logs30 ?? [], (dash.activities ?? []).map((a) => ({ id: a.id, name: a.name })));
    const insight =
      corr && corr.sufficient
        ? `On days you finish 75% or more of your habits, mood averages ${corr.highDayAvg} vs ${corr.lowDayAvg} on other days.`
        : null;
    notes = { summary, signals, insight };
  }

  const quests = dash?.sidequests ? dash.sidequests.filter((s) => !s.completedAt).slice(0, 3) : null;

  return { ring, mood, habit, climb, bars, feed, split, habits, notes, quests };
}
