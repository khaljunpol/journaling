// Pure numbers for the Overview page. Only relative .ts imports of other pure libs, so tests can load it.
import { dayStatus } from './quickDay.ts';
import type { Ctx, DayData, ItemKey } from './quickDay.ts';
import { addDaysISO } from './quickWeek.ts';
import { itemsForTile } from './quickApply.ts';
import type { QuickPayload } from './quickPayload.ts';

/** Habit score moves 5% of the way to each day's result (Loop Habit Tracker style). */
export const HABIT_RATE = 0.05;

/** One day of the slow-decay score. `score` and the result are 0-100; `ratio` is 0-1. */
export function stepScore(score: number, ratio: number): number {
  const r = Math.min(1, Math.max(0, ratio)) * 100;
  return score + HABIT_RATE * (r - score);
}

/**
 * Habit score per day (0-100), oldest first. Days with no active habits are skipped.
 * A day with no habit rows has done = 0, so it counts as r = 0. The score starts at 0.
 */
export function habitScoreSeries(days: Array<{ date: string; done: number; active: number }>): number[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: number[] = [];
  let score = 0;
  for (const d of sorted) {
    if (d.active <= 0) continue;
    score = stepScore(score, d.done / d.active);
    out.push(score);
  }
  return out;
}

/** The last `n` dates up to and including `today`, oldest first. */
export function lastDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysISO(today, i - (n - 1)));
}

/** Mean of logged moods in the 7 days ending `today`. Empty days are skipped. Null when none. One decimal. */
export function moodAvg7(moods: Array<{ date: string; score: number }>, today: string): number | null {
  const from = addDaysISO(today, -6);
  const scores = moods.filter((m) => m.date >= from && m.date <= today).map((m) => m.score);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** Kind wording, never a warning. delta is rounded to one decimal. */
export function trend(current: number, previous: number): { delta: number; text: string } {
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return { delta: 0, text: 'same as last week' };
  return { delta, text: `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs last week` };
}

/** One bar per date: items filled out of items counted (same rule as Today). Missing days are 0 of 0. */
export function stripBars(
  payload: Pick<QuickPayload, 'ctx' | 'days'>,
  dates: string[],
): Array<{ date: string; filled: number; total: number }> {
  return dates.map((date) => {
    const day = payload.days[date];
    if (!day) return { date, filled: 0, total: 0 };
    const s = dayStatus(day, payload.ctx);
    return { date, filled: s.filled, total: s.total };
  });
}

export type FeedState = 'saved' | 'pending' | 'failed';
export type FeedEntry = { kind: ItemKey; text: string; state: FeedState };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Today's entries in card-stack order. State comes from the outbox: failed beats pending beats saved. */
export function todayFeed(
  day: DayData,
  ctx: Ctx,
  queue: Array<{ key: string; state: 'pending' | 'failed' }>,
): FeedEntry[] {
  const active = new Set(ctx.activities.filter((a) => a.status !== 'stopped').map((a) => a.id));
  const habitsDone = day.logs.filter((l) => l.completed && active.has(l.activityId)).length;
  const hoursDone = day.hours.filter((h) => h !== null).length;
  const quests = day.sidequestLogIds.length;
  const rows: Array<{ kind: ItemKey; text: string | null }> = [
    { kind: 'mood', text: day.mood !== null ? `Mood ${day.mood}/10` : null },
    { kind: 'habits', text: habitsDone > 0 ? `Habits ${habitsDone} of ${active.size}` : null },
    { kind: 'weight', text: day.weight !== null ? `Weight ${day.weight} kg` : null },
    { kind: 'sidequests', text: quests > 0 ? (quests === 1 ? 'Side quest logged' : `${quests} side quests logged`) : null },
    { kind: 'hours', text: hoursDone > 0 ? `Hours ${hoursDone} of 24 filled` : null },
    { kind: 'highlight', text: day.highlight.trim() !== '' ? `Highlight: ${clip(day.highlight.trim(), 60)}` : null },
    { kind: 'climb', text: day.climbs > 0 ? `Climbing logged (${day.climbs})` : null },
  ];
  const out: FeedEntry[] = [];
  for (const r of rows) {
    if (r.text === null) continue;
    const items = itemsForTile(queue, r.kind, day.date);
    const state: FeedState = items.some((q) => q.state === 'failed') ? 'failed' : items.length > 0 ? 'pending' : 'saved';
    out.push({ kind: r.kind, text: r.text, state });
  }
  return out;
}

export type TimeSlice = { id: string; name: string; color: string; hours: number };

/** Hours per category in [from, to]. The biggest `max` slices stay; the rest merge into "Other". */
export function timeSplit(
  entries: Array<{ date: string; category: number | string }>,
  cats: Array<{ id: string | number; name: string; color: string }>,
  from: string,
  to: string,
  max = 5,
): { slices: TimeSlice[]; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    const id = String(e.category);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    total += 1;
  }
  const all: TimeSlice[] = [...counts.entries()]
    .map(([id, hours]) => {
      const c = cats.find((x) => String(x.id) === id);
      return { id, name: c?.name ?? 'Other', color: c?.color ?? '#7A84A0', hours };
    })
    .sort((a, b) => b.hours - a.hours);
  if (all.length <= max) return { slices: all, total };
  const rest = all.slice(max).reduce((a, s) => a + s.hours, 0);
  return { slices: [...all.slice(0, max), { id: 'other', name: 'Other', color: '#7A84A0', hours: rest }], total };
}

export type HabitGridRow = { id: string; name: string; done: boolean[]; rate30: number };

/**
 * Per-day habit grid for Trends. `days` is oldest first. One row per habit, sorted by the
 * last-30-days rate (most often done first). Also gives the all-habit rate for the last 7 days
 * and the 7 days before that. A habit counts as done only when a log says completed.
 */
export function habitGrid(
  habits: Array<{ id: string; name: string }>,
  logs: Array<{ date: string; activityId: string; completed: boolean }>,
  days: string[],
): { rows: HabitGridRow[]; week: number; prevWeek: number } {
  const done = new Set(logs.filter((l) => l.completed).map((l) => `${l.date}|${l.activityId}`));
  const rows = habits.map((h) => {
    const flags = days.map((d) => done.has(`${d}|${h.id}`));
    const last30 = flags.slice(-30);
    const rate30 = last30.length ? Math.round((last30.filter(Boolean).length / last30.length) * 100) : 0;
    return { id: h.id, name: h.name, done: flags, rate30 };
  });
  rows.sort((a, b) => b.rate30 - a.rate30 || a.name.localeCompare(b.name));
  const rate = (from: number, to: number) => {
    const cells = rows.length * (to - from);
    if (cells <= 0) return 0;
    const hit = rows.reduce((s, r) => s + r.done.slice(from, to).filter(Boolean).length, 0);
    return Math.round((hit / cells) * 100);
  };
  const n = days.length;
  return { rows, week: rate(Math.max(0, n - 7), n), prevWeek: rate(Math.max(0, n - 14), Math.max(0, n - 7)) };
}
