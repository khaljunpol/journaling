// The points ledger: which days to lock into DayScores, how to read the rows back, and the totals. Pure. Relative imports only.
// Open days (today and the 7 before) are worked out live; older days lock once and never change.
import { addDaysISO } from './quickWeek.ts';
import { MAX_DAY, RULES_V, type DayScore, type GoodCategory } from './scoring.ts';

export type ScoreRow = DayScore & { at: string; v: number };

/** Today and the 7 days before: still open, worked out live. */
export const OPEN_DAYS = 8;
const CATS: GoodCategory[] = ['move', 'wellbeing', 'mind', 'people', 'other'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function openDays(today: string): string[] {
  return Array.from({ length: OPEN_DAYS }, (_, i) => addDaysISO(today, i - (OPEN_DAYS - 1)));
}

/** Closed days not locked yet: after the cursor (or from the first logged day), up to today minus 8. */
export function daysToLock(lockedTo: string | null, firstLogged: string | null, today: string): string[] {
  const start = lockedTo ? addDaysISO(lockedTo, 1) : firstLogged;
  if (!start) return [];
  const end = addDaysISO(today, -OPEN_DAYS);
  const out: string[] = [];
  for (let d = start; d <= end; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** One DayScores row: date, points, done, total, perfect, move, wellbeing, mind, people, other, at, v. */
export function scoreRowValues(s: DayScore, at: string): (string | number)[] {
  return [s.date, s.points, s.done, s.total, s.perfect ? 1 : 0, ...CATS.map((c) => s.byCat[c]), at, RULES_V];
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Rows from the sheet. The first row per date wins. Points outside 0..125, or junk, read as 0: the app trusts the sheet, never a crash. */
export function parseScoreRows(rows: unknown[][]): Map<string, ScoreRow> {
  const out = new Map<string, ScoreRow>();
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const date = String(r[0] ?? '').trim();
    if (!ISO.test(date) || out.has(date)) continue;
    const raw = num(r[1]);
    const ok = raw >= 0 && raw <= MAX_DAY;
    const byCat = Object.fromEntries(CATS.map((c, i) => [c, ok ? Math.max(0, num(r[5 + i])) : 0])) as Record<GoodCategory, number>;
    out.set(date, {
      date,
      points: ok ? raw : 0,
      done: num(r[2]),
      total: num(r[3]),
      perfect: ok && ['1', 'true'].includes(String(r[4] ?? '').trim().toLowerCase()),
      byCat,
      at: String(r[10] ?? ''),
      v: num(r[11]),
    });
  }
  return out;
}

/** Locked rows plus the live open days. A date that is both counts once, as locked. */
export function totals(locked: Map<string, ScoreRow>, open: DayScore[]): { points: number; perfectDays: number } {
  let points = 0;
  let perfectDays = 0;
  for (const r of locked.values()) {
    points += r.points;
    if (r.perfect) perfectDays += 1;
  }
  for (const d of open) {
    if (locked.has(d.date)) continue;
    points += d.points;
    if (d.perfect) perfectDays += 1;
  }
  return { points, perfectDays };
}

/** Scores whose date is not in the sheet yet; a date twice in the batch keeps the first. Run under the lock, after a fresh read. */
export function onlyNewRows(existing: unknown[][], scores: DayScore[]): DayScore[] {
  const seen = new Set(parseScoreRows(existing).keys());
  return scores.filter((s) => (seen.has(s.date) ? false : (seen.add(s.date), true)));
}
