// Pure data for the climbing story image (1080 x 1920). No React, no canvas.
import { FRENCH_GRADES, frenchToIndex, normalizeGrade, vScaleToNumber } from './climbing.ts';
import { localISO, parseLocalDate, weekStartLocal } from './date.ts';

export type StoryLog = { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number };
export type StoryGoal = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const day = (iso: string) => iso.slice(0, 10);

/** "Tue 27 Oct" */
export function formatStoryDate(iso: string): string {
  const d = parseLocalDate(day(iso));
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function logMatchesGoal(log: Pick<StoryLog, 'type' | 'grade'>, goal: Pick<StoryGoal, 'type' | 'grade'>): boolean {
  return log.type === goal.type && normalizeGrade(log.type, log.grade) === normalizeGrade(goal.type, goal.grade);
}

/** Zero-based day of the year, clamped to the goal year (before it: 0, after it: last day). */
function dayIndex(year: number, asOf: string): { i: number; total: number } {
  const total = Math.round((Date.UTC(year, 11, 31) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const [y, m, d] = day(asOf).split('-').map((x) => parseInt(x, 10));
  const i = Math.round((Date.UTC(y, (m || 1) - 1, d || 1) - Date.UTC(year, 0, 1)) / 86400000);
  return { i: Math.min(total - 1, Math.max(0, i)), total };
}

/** Sends of this goal's year and grade, up to and including asOf. */
export function goalSends(goal: StoryGoal, logs: StoryLog[], asOf: string): StoryLog[] {
  const end = day(asOf);
  return logs.filter((l) => day(l.date).startsWith(`${goal.year}-`) && day(l.date) <= end && logMatchesGoal(l, goal));
}

export function paceText(done: number, target: number, expected: number): string {
  if (target > 0 && done >= target) return 'Goal complete';
  const diff = done - expected;
  const d = diff < 0 ? -Math.round(-diff) : Math.round(diff);
  if (d > 0) return `${d} ahead`;
  if (d === 0) return 'On pace';
  return `${-d} to catch up`;
}

export type GoalProgress = { done: number; target: number; pct: number; complete: boolean; expected: number; pace: string };

export function goalProgress(goal: StoryGoal, logs: StoryLog[], asOf: string): GoalProgress {
  const done = goalSends(goal, logs, asOf).length;
  const { i, total } = dayIndex(goal.year, asOf);
  const expected = total > 1 ? goal.target * (i / (total - 1)) : goal.target;
  const complete = goal.target > 0 && done >= goal.target;
  const pct = goal.target ? Math.min(100, Math.round((done / goal.target) * 100)) : 0;
  return { done, target: goal.target, pct, complete, expected, pace: paceText(done, goal.target, expected) };
}

export type GoalLine = { actual: Array<number | null>; ideal: number[]; max: number };

/** One point per day of the goal year: cumulative sends (null after asOf) and the straight on-pace line. */
export function goalLine(goal: StoryGoal, logs: StoryLog[], asOf: string): GoalLine {
  const { i: last, total } = dayIndex(goal.year, asOf);
  const perDay = new Map<number, number>();
  for (const l of goalSends(goal, logs, asOf)) {
    const { i } = dayIndex(goal.year, l.date);
    perDay.set(i, (perDay.get(i) || 0) + 1);
  }
  const actual: Array<number | null> = [];
  const ideal: number[] = [];
  let sum = 0;
  for (let i = 0; i < total; i++) {
    sum += perDay.get(i) || 0;
    actual.push(i <= last ? sum : null);
    ideal.push(total > 1 ? goal.target * (i / (total - 1)) : goal.target);
  }
  return { actual, ideal, max: Math.max(goal.target, sum, 1) };
}

export type SessionStats = { date: string; sends: number; flashes: number; attempts: number; sessions: number; hardest: string; rest: boolean };

export function hardestGrade(logs: Array<Pick<StoryLog, 'type' | 'grade'>>): string {
  const v = logs.filter((l) => l.type === 'boulder').map((l) => vScaleToNumber(l.grade)).filter((n): n is number => n != null);
  const r = logs.filter((l) => l.type === 'rope').map((l) => frenchToIndex(l.grade)).filter((n): n is number => n != null);
  const parts: string[] = [];
  if (v.length) parts.push(`V${Math.max(...v)}`);
  if (r.length) parts.push(FRENCH_GRADES[Math.max(...r)]);
  return parts.length ? parts.join(' · ') : '–';
}

export function sessionStats(logs: StoryLog[], date: string): SessionStats {
  const d = day(date);
  const todays = logs.filter((l) => day(l.date) === d);
  return {
    date: d,
    sends: todays.length,
    flashes: todays.filter((l) => l.attempts === 0).length,
    attempts: todays.reduce((a, l) => a + (l.attempts || 0), 0),
    sessions: new Set(todays.map((l) => l.session)).size,
    hardest: hardestGrade(todays),
    rest: todays.length === 0,
  };
}

export type WeeklySends = { weeks: Array<{ start: string; count: number }>; currentIndex: number; total: number };

/** Sends per Monday-week of the year, from the week of 1 Jan up to the week of asOf (that last week is "current"). */
export function weeklySends(logs: StoryLog[], year: number, asOf: string): WeeklySends {
  const { i } = dayIndex(year, asOf);
  const asOfDate = new Date(year, 0, 1 + i);
  const first = weekStartLocal(new Date(year, 0, 1));
  const lastKey = localISO(weekStartLocal(asOfDate));
  const weeks: Array<{ start: string; count: number }> = [];
  for (const d = new Date(first); localISO(d) <= lastKey; d.setDate(d.getDate() + 7)) weeks.push({ start: localISO(d), count: 0 });
  const byKey = new Map(weeks.map((w) => [w.start, w]));
  const end = day(asOf);
  let total = 0;
  for (const l of logs) {
    const ds = day(l.date);
    if (!ds.startsWith(`${year}-`) || ds > end) continue;
    const w = byKey.get(localISO(weekStartLocal(parseLocalDate(ds))));
    if (w) { w.count += 1; total += 1; }
  }
  return { weeks, currentIndex: weeks.length - 1, total };
}

export type AttemptBucket = { bucket: '0' | '1' | '2' | '3' | '4+'; label: string; count: number };

export function attemptsBuckets(logs: Array<Pick<StoryLog, 'attempts'>>): AttemptBucket[] {
  const out: AttemptBucket[] = [
    { bucket: '0', label: 'Flash', count: 0 },
    { bucket: '1', label: '1', count: 0 },
    { bucket: '2', label: '2', count: 0 },
    { bucket: '3', label: '3', count: 0 },
    { bucket: '4+', label: '4+', count: 0 },
  ];
  for (const l of logs) {
    const a = l.attempts || 0;
    out[a <= 0 ? 0 : Math.min(a, 4)].count += 1;
  }
  return out;
}

/** Latest date with a send (YYYY-MM-DD), or null. */
export function latestSessionDate(logs: Array<Pick<StoryLog, 'date'>>): string | null {
  let best: string | null = null;
  for (const l of logs) { const d = day(l.date); if (!best || d > best) best = d; }
  return best;
}

/** The goal with the most sends on that date; else the first goal of that year; else the first goal. */
export function chooseGoal(goals: StoryGoal[], logs: StoryLog[], date: string): StoryGoal | null {
  if (goals.length === 0) return null;
  const d = day(date);
  const yearGoals = goals.filter((g) => String(g.year) === d.slice(0, 4));
  const pool = yearGoals.length ? yearGoals : goals;
  const todays = logs.filter((l) => day(l.date) === d);
  let best: StoryGoal | null = null;
  let bestCount = 0;
  for (const g of pool) {
    const n = todays.filter((l) => logMatchesGoal(l, g)).length;
    if (n > bestCount) { best = g; bestCount = n; }
  }
  return best ?? pool[0];
}

export type StoryData = {
  date: string;
  dateLabel: string;
  year: number;
  goal: { grade: string; typeLabel: string } & GoalProgress;
  session: SessionStats;
  line: GoalLine;
  weekly: WeeklySends;
  attempts: AttemptBucket[];
};

export function buildStory(goal: StoryGoal, logs: StoryLog[], date: string): StoryData {
  const d = day(date);
  const progress = goalProgress(goal, logs, d);
  return {
    date: d,
    dateLabel: formatStoryDate(d),
    year: goal.year,
    goal: { grade: goal.type === 'boulder' ? goal.grade.toUpperCase() : goal.grade, typeLabel: goal.type === 'boulder' ? 'Boulder' : 'Rope', ...progress },
    session: sessionStats(logs, d),
    line: goalLine(goal, logs, d),
    weekly: weeklySends(logs, goal.year, d),
    attempts: attemptsBuckets(goalSends(goal, logs, d)),
  };
}

export type YearGoalRow = { id: string; grade: string; typeLabel: string } & GoalProgress;
export type YearStoryData = { date: string; dateLabel: string; year: number; total: GoalProgress; goals: YearGoalRow[] };

/** Every goal of the date's year, plus one total (sums of sends, targets and on-pace). */
export function buildYearStory(goals: StoryGoal[], logs: StoryLog[], date: string): YearStoryData {
  const d = day(date);
  const year = parseInt(d.slice(0, 4), 10);
  const rows: YearGoalRow[] = goals
    .filter((g) => g.year === year)
    .map((g) => ({
      id: g.id,
      grade: g.type === 'boulder' ? g.grade.toUpperCase() : g.grade,
      typeLabel: g.type === 'boulder' ? 'Boulder' : 'Rope',
      ...goalProgress(g, logs, d),
    }));
  // Extra sends on one goal do not fill another, so the total reaches 100% only when every goal does.
  const done = rows.reduce((a, r) => a + Math.min(r.done, r.target), 0);
  const target = rows.reduce((a, r) => a + r.target, 0);
  const expected = rows.reduce((a, r) => a + r.expected, 0);
  const complete = rows.length > 0 && rows.every((r) => r.complete);
  const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const pace = complete ? 'Goal complete' : paceText(done, target, expected);
  return { date: d, dateLabel: formatStoryDate(d), year, total: { done, target, pct, complete, expected, pace }, goals: rows };
}
