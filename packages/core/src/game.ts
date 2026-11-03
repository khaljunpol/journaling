// The whole game in one state: points, level, today, streaks, badges. Pure. Relative imports only.
// Locked days come from DayScores; every other day is worked out live with the same rules,
// so the preview before the history import equals what the import writes.
import { BADGES, earnedBadges, mergeBadges } from './badges.ts';
import { appDay, type DayStamp } from './dayState.ts';
import type { HabitCategory } from './habitCategory.ts';
import { daysToLock, type ScoreRow } from './ledger.ts';
import type { HabitLog } from './overviewStats.ts';
import { addDaysISO } from './quickWeek.ts';
import { LATE_DAYS, levelFor, scoreDay, type DayScore } from './scoring.ts';
import { habitStreaks, type Streak } from './streaks.ts';

type Act = { id: string; name: string; category?: HabitCategory };
type Templates = { weekday: string[] | null; weekend: string[] | null };

export type GameInput = {
  today: string;
  logs: HabitLog[];
  activities: Act[];
  templates: Templates;
  stamps: DayStamp[];
  /** Dates with a bulk-fill mark. */
  fills: Set<string>;
};

export type GameState = {
  points: number;
  level: number;
  into: number;
  toNext: number;
  cost: number;
  perfectDays: number;
  today: { done: number; total: number; points: number; perfect: boolean };
  streaks: Streak[];
  badges: Record<string, string>;
  next: { id: string; label: string } | null;
  /** Days logged 1 to 7 days late. */
  rescued: number;
  /** false = live preview: nothing is locked yet. */
  imported: boolean;
  /** The World in one line: plantings so far, the tallest habit plant, this week's goal. Added by the server. */
  world?: { planted: number; tallest: { name: string; tiles: number } | null; weekMet: boolean; climbed: boolean };
};

/** Logs by date, first habits stamp by date, and the first logged day. */
function index(input: GameInput) {
  const byDate = new Map<string, HabitLog[]>();
  let first: string | null = null;
  for (const l of input.logs) {
    const d = l.date.slice(0, 10);
    if (d > input.today) continue;
    if (!first || d < first) first = d;
    const list = byDate.get(d) ?? [];
    list.push(l);
    byDate.set(d, list);
  }
  const stampAt = new Map<string, string>();
  for (const s of input.stamps) {
    if (s.kind !== 'habits') continue;
    const prev = stampAt.get(s.date);
    if (!prev || new Date(s.at) < new Date(prev)) stampAt.set(s.date, s.at);
  }
  const score = (date: string): DayScore =>
    scoreDay({ date, logs: byDate.get(date) ?? [], activities: input.activities, templates: input.templates, firstHabitStamp: stampAt.get(date) ?? null, filled: input.fills.has(date) });
  return { byDate, first, stampAt, score };
}

/** Day scores to append: closed days after the cursor (or from the first logged day). A day with no points and no usual list gets no row; a 0-point day with a list is kept, so weekly totals stay the same after the lock. */
export function scoresToLock(input: GameInput & { lockedTo: string | null }): DayScore[] {
  const { first, score } = index(input);
  return daysToLock(input.lockedTo, first, input.today).map(score).filter((s) => s.points > 0 || s.total > 0);
}

/** Per-date points for the calendar: locked rows win, every other date is worked out live. */
export function dayPoints(input: GameInput & { locked: Map<string, ScoreRow>; lockedTo?: string | null }, from: string, to: string): Map<string, { points: number; perfect: boolean }> {
  const { score } = index(input);
  const closed = (d: string) => !!input.lockedTo && d <= input.lockedTo;
  const out = new Map<string, { points: number; perfect: boolean }>();
  const end = to < input.today ? to : input.today;
  for (let d = from; d <= end; d = addDaysISO(d, 1)) {
    const s = input.locked.get(d) ?? (closed(d) ? null : score(d));
    if (s && s.points > 0) out.set(d, { points: s.points, perfect: s.perfect });
  }
  return out;
}

/** The last date a lock run covers (today minus 8), for the `scoresLockedTo` cursor. */
export const lockCursor = (today: string) => addDaysISO(today, -8);

export function gameState(input: GameInput & { locked: Map<string, ScoreRow>; storedBadges: Record<string, string>; imported: boolean; lockedTo?: string | null }): GameState {
  const { today, locked } = input;
  const { first, stampAt, score } = index(input);
  // A closed day with no row was locked at 0 points (0-point days get no row). It stays 0: a re-tag or a late tick never adds to it.
  const closed = (d: string) => input.imported && !!input.lockedTo && d <= input.lockedTo;
  let points = 0;
  let perfectDays = 0;
  if (first) {
    for (let d = first; d <= today; d = addDaysISO(d, 1)) {
      const s = locked.get(d) ?? (closed(d) ? null : score(d));
      if (!s) continue;
      points += s.points;
      if (s.perfect) perfectDays += 1;
    }
  }
  // Locked rows dated before the first log still in the sheet (a habit's logs deleted later) keep counting.
  for (const [d, r] of locked) {
    if (first && d >= first) continue;
    points += r.points;
    if (r.perfect) perfectDays += 1;
  }

  const t = score(today);
  const streaks = habitStreaks({ logs: input.logs, activities: input.activities, templates: input.templates, today });
  let rescued = 0;
  for (const [date, at] of stampAt) {
    const day = appDay(new Date(at));
    if (day > date && day <= addDaysISO(date, LATE_DAYS) && date <= today) rescued += 1;
  }
  const lv = levelFor(points);
  const bestStreakDays = Math.max(0, ...streaks.filter((s) => s.unit === 'days').map((s) => s.best));
  const badges = mergeBadges(input.storedBadges, earnedBadges({ perfectDays, bestStreakDays, level: lv.level, rescued }), today);
  return {
    points,
    ...lv,
    perfectDays,
    today: { done: t.done, total: t.total, points: t.points, perfect: t.perfect },
    streaks,
    badges,
    next: BADGES.find((b) => !badges[b.id]) ?? null,
    rescued,
    imported: input.imported,
  };
}

/** GET /api/device?include=game: small, and only these keys. The top streak is from good habits only. */
export type DeviceGame = {
  points: number;
  level: number;
  toNext: number;
  perfectDays: number;
  today: { done: number; total: number };
  topStreak: { name: string; days: number; unit: 'days' | 'weeks' } | null;
};

export function deviceGame(g: GameState): DeviceGame {
  const top = g.streaks.find((s) => s.current > 0) ?? null;
  return {
    points: g.points,
    level: g.level,
    toNext: g.toNext,
    perfectDays: g.perfectDays,
    today: { done: g.today.done, total: g.today.total },
    topStreak: top ? { name: top.name, days: top.current, unit: top.unit } : null,
  };
}

/** Every day that earned points, oldest first: locked rows win, open days are live, closed days with no row earned 0. For the World.
 * `withZero`: also days with a usual list but no points (the weekly goal needs their totals). */
export function dayScores(input: GameInput & { locked: Map<string, ScoreRow>; lockedTo?: string | null; withZero?: boolean }): DayScore[] {
  const { first, score } = index(input);
  const closed = (d: string) => !!input.lockedTo && d <= input.lockedTo;
  const out = new Map<string, DayScore>();
  for (const [d, r] of input.locked) if (d <= input.today && (r.points > 0 || (input.withZero && r.total > 0))) out.set(d, r);
  if (first) {
    for (let d = first; d <= input.today; d = addDaysISO(d, 1)) {
      if (out.has(d) || input.locked.has(d) || closed(d)) continue;
      const s = score(d);
      if (s.points > 0 || (input.withZero && s.total > 0)) out.set(d, s);
    }
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}
