// Every number on the Overview questions screen, as pure functions. No React, no I/O.
// Dates are local YYYY-MM-DD. Weeks start Monday. Rows dated after today are ignored.
import { daysSince, sessionsCount, type Log } from './climbStats.ts';
import { localISO, parseLocalDate, weekStartLocal } from './date.ts';
import { addDaysISO, mondayOf } from './quickWeek.ts';

export type MoodRow = { date: string; score: number | string };
/** `category` is the time category id (the hours sheet stores the id; ids may arrive as numbers). */
export type HourRow = { date: string; hour: number; category: number | string };
export type HabitLog = { date: string; activityId: string; completed: boolean };
export type Cat = { id: string; name: string; color: string };
export type HabitDay = { date: string; done: number; active: number; share: number };

const round1 = (x: number) => Math.round(x * 10) / 10;
const day = (iso: string) => iso.slice(0, 10);
const score = (r: MoodRow) => Number(r.score);
const validScore = (r: MoodRow) => Number.isFinite(score(r)) && String(r.score).trim() !== '';

function meanOrNull(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** This week Mon..today, and last week over the same weekdays. */
export function weekWindow(today: string): { from: string; to: string; prevFrom: string; prevTo: string } {
  const from = localISO(weekStartLocal(parseLocalDate(today)));
  return { from, to: today, prevFrom: addDaysISO(from, -7), prevTo: addDaysISO(today, -7) };
}

function weekMean(by: Map<string, number>, from: string, to: string): { avg: number | null; days: number } {
  const vals = [...by].filter(([d]) => d >= from && d <= to).map(([, v]) => v);
  const m = meanOrNull(vals);
  return { avg: m == null ? null : round1(m), days: vals.length };
}

export function moodWeek(moods: MoodRow[], today: string): { avg: number | null; prevAvg: number | null; days: number } {
  const w = weekWindow(today);
  const by = moodByDate(moods, today);
  const cur = weekMean(by, w.from, w.to);
  return { avg: cur.avg, prevAvg: weekMean(by, w.prevFrom, w.prevTo).avg, days: cur.days };
}

/** One mean mood per date (rows after `to` are dropped when `to` is given). */
function moodByDate(moods: MoodRow[], to?: string): Map<string, number> {
  const sums = new Map<string, { s: number; n: number }>();
  for (const m of moods) {
    const d = day(m.date);
    if (!validScore(m) || (to && d > to)) continue;
    const e = sums.get(d) ?? { s: 0, n: 0 };
    e.s += score(m);
    e.n += 1;
    sums.set(d, e);
  }
  return new Map([...sums].map(([d, e]) => [d, e.s / e.n]));
}

/** The mean mood of each week (keyed by its Monday), up to today: one mean per day first, then the mean of those days. Same rules as moodWeek. */
export function weeklyMoods(moods: MoodRow[], today: string): Map<string, number> {
  const weeks = new Map<string, number[]>();
  for (const [d, v] of moodByDate(moods, today)) {
    const m = mondayOf(d);
    weeks.set(m, [...(weeks.get(m) ?? []), v]);
  }
  return new Map([...weeks].map(([m, vs]) => [m, vs.reduce((a, b) => a + b, 0) / vs.length]));
}

/** n daily slots ending today, oldest first. Gaps are null. */
export function dailySeries(rows: MoodRow[], today: string, n: number): Array<{ date: string; value: number | null }> {
  const by = moodByDate(rows, today);
  return Array.from({ length: n }, (_, i) => {
    const date = addDaysISO(today, i - (n - 1));
    const v = by.get(date);
    return { date, value: v == null ? null : round1(v) };
  });
}

/** Ids of time categories whose trimmed, lower-case name starts with "sleep". */
export function findSleepIds(cats: Array<Cat & { group?: string }>): Set<string> {
  // A saved group wins (Settings > Time categories); a blank one falls back to the name.
  const isSleep = (c: Cat & { group?: string }) => (c.group ? c.group === 'sleep' : c.name.trim().toLowerCase().startsWith('sleep'));
  return new Set(cats.filter(isSleep).map((c) => String(c.id)));
}

/**
 * Night ending on D = sleep hours at D-1 18..23 plus D 0..11. null when no sleep hour is logged.
 * `today`: tonight's night (ending today) is only known once a morning hour (0..11) is logged,
 * so last evening alone never reads as a short night.
 */
export function sleepNights(hours: HourRow[], sleepIds: Set<string>, dates: string[], today?: string): Array<{ date: string; hours: number | null }> {
  const counts = new Map<string, number>();
  let morningToday = false;
  const seen = new Set<string>();
  if (sleepIds.size > 0) {
    for (const h of hours) {
      if (!sleepIds.has(String(h.category))) continue;
      const d = day(h.date);
      const key = `${d}|${h.hour}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (h.hour >= 18) {
        const next = addDaysISO(d, 1);
        counts.set(next, (counts.get(next) ?? 0) + 1);
      } else if (h.hour <= 11) {
        counts.set(d, (counts.get(d) ?? 0) + 1);
        if (d === today) morningToday = true;
      }
    }
  }
  return dates.map((date) => ({ date, hours: date === today && !morningToday ? null : counts.get(date) ?? null }));
}

export function avgKnown(nights: Array<{ date: string; hours: number | null }>): number | null {
  const m = meanOrNull(nights.flatMap((n) => (n.hours == null ? [] : [n.hours])));
  return m == null ? null : round1(m);
}

/** Sample standard deviation; 0 under 2 values. */
function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Mean mood on high-side days vs low-side days. byDate: true = high side. Null under `min.pairs` pairs or `min.side` per side (default 10/3). */
export function moodSplit(
  moods: MoodRow[],
  byDate: Map<string, boolean>,
  today: string,
  min: { pairs: number; side: number } = { pairs: 10, side: 3 },
): { hi: number; lo: number; nHi: number; nLo: number; diff: number; sdHi: number; sdLo: number } | null {
  const by = moodByDate(moods, today);
  const hi: number[] = [];
  const lo: number[] = [];
  for (const [date, high] of byDate) {
    if (date > today) continue;
    const m = by.get(date);
    if (m == null) continue;
    (high ? hi : lo).push(m);
  }
  if (hi.length + lo.length < min.pairs || hi.length < min.side || lo.length < min.side) return null;
  const hiAvg = meanOrNull(hi) as number;
  const loAvg = meanOrNull(lo) as number;
  return { hi: round1(hiAvg), lo: round1(loAvg), nHi: hi.length, nLo: lo.length, diff: round1(hiAvg - loAvg), sdHi: sd(hi), sdLo: sd(lo) };
}

/** Per date: completed checks of the active habits (each habit once) and their share. */
export function habitDays(logs: HabitLog[], activeIds: Set<string>, dates: string[]): HabitDay[] {
  const doneBy = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!l.completed || !activeIds.has(l.activityId)) continue;
    const d = day(l.date);
    const s = doneBy.get(d) ?? new Set<string>();
    s.add(l.activityId);
    doneBy.set(d, s);
  }
  const active = activeIds.size;
  return dates.map((date) => {
    const done = doneBy.get(date)?.size ?? 0;
    return { date, done, active, share: active > 0 ? done / active : 0 };
  });
}

/** Every date from max(first, floor) to today, oldest first. A stray very old row can't push today out. */
export function daySpan(first: string, today: string, floor: string): string[] {
  const out: string[] = [];
  for (let d = first > floor ? first : floor; d <= today; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Whole percent of checks done over the days; null when there are no active habits. */
export function habitRate(days: HabitDay[]): number | null {
  const active = days.reduce((a, d) => a + d.active, 0);
  if (active === 0) return null;
  return Math.round((days.reduce((a, d) => a + d.done, 0) / active) * 100);
}

const GOOD = 0.5;

/** Days in a row with share >= 50%. Today counts only when it already meets that; otherwise count from yesterday. */
export function habitStreak(days: HabitDay[], today: string): number {
  const by = new Map(days.filter((d) => d.date <= today).map((d) => [d.date, d]));
  let cursor = (by.get(today)?.share ?? 0) >= GOOD ? today : addDaysISO(today, -1);
  let n = 0;
  for (;;) {
    const d = by.get(cursor);
    if (!d || d.share < GOOD) return n;
    n += 1;
    cursor = addDaysISO(cursor, -1);
  }
}

/** Days back an empty day can still be filled in. */
const GRACE_DAYS = 7;

/**
 * habitStreak, but a recent day with no habit rows waits to be filled in: it neither ends the streak nor adds to it.
 * `logged` holds dates with any habit row. Grace starts at `startAt`, or at the first logged day.
 */
export function habitStreakGrace(days: HabitDay[], logged: Set<string>, today: string, startAt?: string): { streak: number; waiting: number } {
  // Grace starts at the first logged day: a blank day before the user began is not waiting to be filled in.
  const start = startAt ?? [...logged].reduce((a, b) => (b < a ? b : a), '9999-12-31');
  const by = new Map(days.filter((d) => d.date <= today).map((d) => [d.date, d]));
  const limit = addDaysISO(today, -GRACE_DAYS);
  let cursor = (by.get(today)?.share ?? 0) >= GOOD ? today : addDaysISO(today, -1);
  let streak = 0;
  let waiting = 0;
  for (;;) {
    const d = by.get(cursor);
    if (!d) return { streak, waiting };
    if (d.share >= GOOD) streak += 1;
    else if (!logged.has(cursor) && cursor >= start && cursor >= limit) waiting += 1;
    else return { streak, waiting };
    cursor = addDaysISO(cursor, -1);
  }
}

/** Longest run of consecutive dates with share >= 50%. */
export function bestStreak(days: HabitDay[], today: string): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days.filter((x) => x.date <= today).sort((a, b) => a.date.localeCompare(b.date))) {
    if (d.share >= GOOD) {
      run = prev !== null && addDaysISO(prev, 1) === d.date && run > 0 ? run + 1 : 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    prev = d.date;
  }
  return best;
}

export type TimeRow = { id: string; name: string; color: string; hours: number; prev: number };

/**
 * Hours per category this week vs the same days last week. One row of `entries` = one hour.
 * rows: categories with hours this week, top `max` (chart). other: the rest rolled up, or null.
 * all: every category with hours in either week, by this-week hours desc (Time sheet).
 * total and top use this week only.
 */
export function timeCompare(
  entries: HourRow[],
  cats: Cat[],
  today: string,
  max = 5,
): { rows: TimeRow[]; other: { hours: number; prev: number } | null; all: TimeRow[]; total: number; top: { name: string; hours: number; delta: number } | null } {
  const w = weekWindow(today);
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const e of entries) {
    const d = day(e.date);
    const id = String(e.category);
    if (d >= w.from && d <= w.to) cur.set(id, (cur.get(id) ?? 0) + 1);
    else if (d >= w.prevFrom && d <= w.prevTo) prev.set(id, (prev.get(id) ?? 0) + 1);
  }
  const ids = new Set([...cur.keys(), ...prev.keys()]);
  const all: TimeRow[] = [...ids]
    .map((id) => {
      const c = cats.find((x) => String(x.id) === id);
      return { id, name: c?.name ?? 'Other', color: c?.color ?? '#7A84A0', hours: cur.get(id) ?? 0, prev: prev.get(id) ?? 0 };
    })
    .sort((a, b) => b.hours - a.hours || b.prev - a.prev);
  const thisWeek = all.filter((r) => r.hours > 0);
  const rest = thisWeek.slice(max);
  const total = thisWeek.reduce((a, r) => a + r.hours, 0);
  const t = thisWeek[0];
  return {
    rows: thisWeek.slice(0, max),
    other: rest.length ? { hours: rest.reduce((a, r) => a + r.hours, 0), prev: rest.reduce((a, r) => a + r.prev, 0) } : null,
    all,
    total,
    top: t ? { name: t.name, hours: t.hours, delta: t.hours - t.prev } : null,
  };
}

/** Same day of the month, one month back, clamped to that month's end. */
export function monthAgo(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Newest non-empty highlight in the last `within` days, not today. */
export function lastHighlight(rows: Array<{ date: string; text: string }>, today: string, within = 30): { date: string; text: string } | null {
  const from = addDaysISO(today, -within);
  let best: { date: string; text: string } | null = null;
  for (const r of rows) {
    const date = day(r.date);
    const text = (r.text ?? '').trim();
    if (!text || date >= today || date < from) continue;
    if (!best || date > best.date) best = { date, text };
  }
  return best;
}

/** Sessions Mon..today (unique date+session pairs), plus the latest session date. Logs without `session` count as one per date. */
/**
 * Climb rows for the Overview line: this year's rows plus last year's rows from the 30-day read.
 * Without these, the line goes blank in early January (this year's read is empty or too short).
 */
export function climbRows<T extends { date: string }>(year: T[], last30: T[], today: string): T[] {
  const yStart = `${today.slice(0, 4)}-01-01`;
  return [...year, ...last30.filter((l) => day(l.date) < yStart)];
}

export function climbWeek(
  logs: Array<{ date: string; session?: number }>,
  today: string,
): { sessions: number; last: string | null; daysSince: number | null } {
  const past = logs.filter((l) => day(l.date) <= today).map((l) => ({ ...l, session: l.session ?? 0 }) as Log);
  const { from } = weekWindow(today);
  const sessions = sessionsCount(past.filter((l) => day(l.date) >= from));
  const since = daysSince(past, today);
  const last = past.length ? past.map((l) => day(l.date)).reduce((a, b) => (b > a ? b : a)) : null;
  return { sessions, last, daysSince: since };
}

/** "7h 10m" for sleep, "22h" for whole hours. */
export function hm(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
