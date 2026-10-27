// Every climbing number on Overview, as pure functions. No React, no I/O.
import { FRENCH_GRADES, frenchToIndex, normalizeGrade, vScaleToNumber } from './climbing.ts';
import { localISO, parseLocalDate, weekStartLocal } from './date.ts';

export type ClimbType = 'boulder' | 'rope';
export type Log = { id: string; date: string; session: number; type: ClimbType; grade: string; attempts: number; location?: string };
export type GoalSpec = { year: number; type: ClimbType; grade: string; target: number };

const day = (iso: string) => iso.slice(0, 10);
const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (sum: number, count: number) => (count > 0 ? sum / count : 0);

/** Sort position of a grade within its type (higher = harder), or null when it can't be read. */
function rank(type: ClimbType, grade: string): number | null {
  return type === 'boulder' ? vScaleToNumber(grade) : frenchToIndex(grade);
}

/** "v4" -> "V4", "6A" -> "6a"; unreadable grades come back trimmed. */
function label(type: ClimbType, grade: string): string {
  const r = rank(type, grade);
  if (r == null) return grade.trim();
  return type === 'boulder' ? `V${r}` : FRENCH_GRADES[r];
}

/** Hardest first, unreadable last (the sort is stable). */
const hardestFirst = (a: number | null, b: number | null) => (a == null ? 1 : 0) - (b == null ? 1 : 0) || (b ?? 0) - (a ?? 0);

type GradeGroup = { grade: string; rank: number | null; logs: Log[] };

function groupByGrade(logs: Log[], type: ClimbType): GradeGroup[] {
  const map = new Map<string, GradeGroup>();
  for (const l of logs) {
    if (l.type !== type) continue;
    const key = normalizeGrade(type, l.grade);
    const g = map.get(key) ?? { grade: label(type, l.grade), rank: rank(type, l.grade), logs: [] };
    g.logs.push(l);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => hardestFirst(a.rank, b.rank));
}

const weekStartISO = (iso: string) => localISO(weekStartLocal(parseLocalDate(day(iso))));

function addDays(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  return localISO(d);
}

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = day(fromISO).split('-').map((x) => parseInt(x, 10));
  const [ty, tm, td] = day(toISO).split('-').map((x) => parseInt(x, 10));
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** Hardest grade of each type, e.g. "V5 · 6c", or null with no readable sends. */
function bestLabel(logs: Log[]): string | null {
  const parts: string[] = [];
  for (const type of ['boulder', 'rope'] as const) {
    const top = groupByGrade(logs, type).find((g) => g.rank != null);
    if (top) parts.push(top.grade);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** Unique date + session pairs. */
export function sessionsCount(logs: Log[]): number {
  return new Set(logs.map((l) => `${day(l.date)}|${l.session}`)).size;
}

/** Sends per Monday-week from the week of fromISO to the week of toISO, zeros included. */
export function weeklySeries(logs: Log[], fromISO: string, toISO: string): Array<{ start: string; count: number }> {
  const last = weekStartISO(toISO);
  const weeks: Array<{ start: string; count: number }> = [];
  for (let s = weekStartISO(fromISO); s <= last; s = addDays(s, 7)) weeks.push({ start: s, count: 0 });
  const byStart = new Map(weeks.map((w) => [w.start, w]));
  for (const l of logs) {
    const w = byStart.get(weekStartISO(l.date));
    if (w) w.count += 1;
  }
  return weeks;
}

/** Mean sends over the last `weeks` weeks (this week included), rest weeks counted as 0. */
export function sendsPerWeek(logs: Log[], today: string, weeks = 12): number {
  const series = weeklySeries(logs, addDays(weekStartISO(today), -7 * (weeks - 1)), today);
  return round1(mean(series.reduce((a, w) => a + w.count, 0), series.length));
}

/** Dates newest first, sessions ascending, logs keep their input order. */
export function groupBySession(logs: Log[]): Array<{ date: string; sessions: Array<{ session: number; logs: Log[] }> }> {
  const byDate = new Map<string, Map<number, Log[]>>();
  for (const l of logs) {
    const d = day(l.date);
    const sessions = byDate.get(d) ?? new Map<number, Log[]>();
    sessions.set(l.session, [...(sessions.get(l.session) ?? []), l]);
    byDate.set(d, sessions);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, sessions]) => ({
      date,
      sessions: [...sessions.entries()].sort((a, b) => a[0] - b[0]).map(([session, ls]) => ({ session, logs: ls })),
    }));
}

export type GoalPace = { done: number; target: number; weeksLeft: number; neededPerWeek: number; recentPerWeek: number; onTrack: boolean; projected: number; ended: boolean };

export function goalPace(goal: GoalSpec, logs: Log[], today: string): GoalPace {
  const t = day(today);
  const jan1 = `${goal.year}-01-01`;
  const dec31 = `${goal.year}-12-31`;
  const mine = logs.filter((l) => day(l.date).startsWith(`${goal.year}-`) && l.type === goal.type && normalizeGrade(l.type, l.grade) === normalizeGrade(goal.type, goal.grade));
  const done = mine.filter((l) => day(l.date) <= t).length;
  const ended = t > dec31;
  const weeksLeft = ended ? 0 : Math.max(1, Math.floor(daysBetween(t < jan1 ? jan1 : t, dec31) / 7));
  const neededPerWeek = ended ? 0 : Math.max(0, round1((goal.target - done) / weeksLeft));
  // Last 8 weeks that sit inside the goal year, rest weeks counted as 0.
  const end = t < jan1 ? jan1 : t > dec31 ? dec31 : t;
  const windowStart = addDays(weekStartISO(end), -49);
  const series = weeklySeries(mine, windowStart < jan1 ? jan1 : windowStart, end);
  const recent = mean(series.reduce((a, w) => a + w.count, 0), series.length);
  const projected = Math.round(done + recent * weeksLeft);
  return { done, target: goal.target, weeksLeft, neededPerWeek, recentPerWeek: round1(recent), onTrack: projected >= goal.target, projected, ended };
}

export function gradePyramid(logs: Log[], type: ClimbType): Array<{ grade: string; count: number }> {
  return groupByGrade(logs, type).map((g) => ({ grade: g.grade, count: g.logs.length }));
}

/** Hardest readable send, earliest date on a tie. */
function hardestOf(logs: Log[], type: ClimbType): { grade: string; date: string } | null {
  let best: { r: number; grade: string; date: string } | null = null;
  for (const l of logs) {
    if (l.type !== type) continue;
    const r = rank(type, l.grade);
    if (r == null) continue;
    const d = day(l.date);
    if (!best || r > best.r || (r === best.r && d < best.date)) best = { r, grade: label(type, l.grade), date: d };
  }
  return best && { grade: best.grade, date: best.date };
}

export const hardestSend = (logs: Log[], type: ClimbType) => hardestOf(logs, type);
export const hardestFlash = (logs: Log[], type: ClimbType) => hardestOf(logs.filter((l) => l.attempts === 0), type);

/** Grade of a send on `date` that beats every earlier send of its type (boulder first, then rope). */
export function newBest(logs: Log[], date: string): string | null {
  const d = day(date);
  for (const type of ['boulder', 'rope'] as const) {
    const ranks = (ls: Log[]) => ls.map((l) => rank(type, l.grade)).filter((r): r is number => r != null);
    const before = ranks(logs.filter((l) => l.type === type && day(l.date) < d));
    const today = logs.filter((l) => l.type === type && day(l.date) === d && rank(type, l.grade) != null);
    if (before.length === 0 || today.length === 0) continue;
    const top = today.reduce((a, l) => (rank(type, l.grade)! > rank(type, a.grade)! ? l : a));
    if (rank(type, top.grade)! > Math.max(...before)) return label(type, top.grade);
  }
  return null;
}

/** 12 entries (month 1-12); grade is null for a month without readable sends. */
export function hardestByMonth(logs: Log[], year: number, type: ClimbType): Array<{ month: number; grade: string | null }> {
  return Array.from({ length: 12 }, (_, i) => {
    const prefix = `${year}-${String(i + 1).padStart(2, '0')}-`;
    const top = groupByGrade(logs.filter((l) => day(l.date).startsWith(prefix)), type).find((g) => g.rank != null);
    return { month: i + 1, grade: top ? top.grade : null };
  });
}

/** First send date per grade (by log date, not sheet order), hardest first. */
export function firstSends(logs: Log[], type: ClimbType): Array<{ grade: string; date: string }> {
  return groupByGrade(logs, type).map((g) => ({ grade: g.grade, date: g.logs.map((l) => day(l.date)).reduce((a, b) => (b < a ? b : a)) }));
}

export function gradeTable(logs: Log[], type: ClimbType): Array<{ grade: string; sends: number; flashPct: number; avgFalls: number }> {
  return groupByGrade(logs, type).map((g) => {
    const flashes = g.logs.filter((l) => l.attempts === 0).length;
    return {
      grade: g.grade,
      sends: g.logs.length,
      flashPct: Math.round((flashes / g.logs.length) * 100),
      avgFalls: round1(mean(g.logs.reduce((a, l) => a + (l.attempts || 0), 0), g.logs.length)),
    };
  });
}

/** Hardest grade with at least 3 sends and a flash rate of 50% or more. */
export function flashGrade(logs: Log[], type: ClimbType): string | null {
  const hit = groupByGrade(logs, type).find((g) => g.rank != null && g.logs.length >= 3 && g.logs.filter((l) => l.attempts === 0).length * 2 >= g.logs.length);
  return hit ? hit.grade : null;
}

/** Monday weeks in a row with a log, counting back from this week (or from last week if this one is still empty). */
export function weekStreak(logs: Log[], today: string): number {
  const weeks = new Set(logs.map((l) => weekStartISO(l.date)));
  let cursor = weekStartISO(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

export function daysSince(logs: Log[], today: string): number | null {
  if (logs.length === 0) return null;
  const latest = logs.map((l) => day(l.date)).reduce((a, b) => (b > a ? b : a));
  return Math.max(0, daysBetween(latest, today));
}

/** Sessions per weekday, Monday first. */
export function weekdayCounts(logs: Log[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const seen = new Set<string>();
  for (const l of logs) {
    const key = `${day(l.date)}|${l.session}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[(parseLocalDate(day(l.date)).getDay() + 6) % 7] += 1;
  }
  return counts;
}

export function sessionRecords(logs: Log[]): { avgSends: number; most: number; mostDate: string | null } {
  const sessions = new Map<string, { date: string; count: number }>();
  for (const l of logs) {
    const key = `${day(l.date)}|${l.session}`;
    const s = sessions.get(key) ?? { date: day(l.date), count: 0 };
    s.count += 1;
    sessions.set(key, s);
  }
  let most = 0;
  let mostDate: string | null = null;
  for (const s of sessions.values()) {
    if (s.count > most || (s.count === most && mostDate != null && s.date < mostDate)) { most = s.count; mostDate = s.date; }
  }
  return { avgSends: round1(mean(logs.length, sessions.size)), most, mostDate };
}

type YearStats = { sends: number; sessions: number; best: string | null };

/** This year up to today, against last year up to the same month and day. */
export function yearOverYear(logs: Log[], today: string): { thisYear: YearStats; lastYear: YearStats } {
  const t = day(today);
  const year = parseInt(t.slice(0, 4), 10);
  const monthDay = t.slice(5);
  const stats = (y: number): YearStats => {
    const ls = logs.filter((l) => day(l.date).startsWith(`${y}-`) && day(l.date).slice(5) <= monthDay);
    return { sends: ls.length, sessions: sessionsCount(ls), best: bestLabel(ls) };
  };
  return { thisYear: stats(year), lastYear: stats(year - 1) };
}

/** Sends per gym, most first. A blank location is "No gym". */
export function byGym(logs: Log[]): Array<{ gym: string; count: number }> {
  const counts = new Map<string, number>();
  for (const l of logs) {
    const gym = (l.location ?? '').trim() || 'No gym';
    counts.set(gym, (counts.get(gym) ?? 0) + 1);
  }
  return [...counts.entries()].map(([gym, count]) => ({ gym, count })).sort((a, b) => b.count - a.count || a.gym.localeCompare(b.gym));
}
