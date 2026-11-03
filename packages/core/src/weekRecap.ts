// Last week in one short summary: Monday to Sunday, finished weeks only. Pure. Relative imports only.
import { parseLocalDate } from './date.ts';
import { dayState, type DayStamp, type Line } from './dayState.ts';
import { insightLine, lifts, type InsightInput } from './insights.ts';
import {
  avgKnown,
  dailySeries,
  findSleepIds,
  habitDays,
  habitRate,
  moodWeek,
  sleepNights,
  timeCompare,
  type Cat,
  type HabitLog,
  type HourRow,
  type MoodRow,
} from './overviewStats.ts';
import { addDaysISO, mondayOf, weekDates } from './quickWeek.ts';

export type WeekRecap = {
  /** Monday. */
  from: string;
  /** Sunday. */
  to: string;
  /** The week's mean, and the change from the week before. */
  mood: { avg: number | null; delta: number | null };
  /** Mean hours a night. */
  sleep: number | null;
  /** Percent done, null when no habit was logged. */
  habits: number | null;
  /** Null when tracking hadn't started. A missed day that gets filled in moves to late. */
  days: { onTime: number; late: number; missed: number } | null;
  /** The biggest use of time, sleep left out. */
  time: { name: string; hours: number } | null;
  /** The one line that stands out. */
  note: Line | null;
};

const round1 = (x: number) => Math.round(x * 10) / 10;
/** Mood days a week needs before one can be called the best. */
const BEST_MIN = 3;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Best mood day of the week first: it changes every week. The top lift from insights.ts is the fallback. */
function noteFor(moods: MoodRow[], hours: HourRow[], logs: HabitLog[], cats: Cat[], activities: InsightInput['activities'], to: string): Line | null {
  const known = dailySeries(moods, to, 7).flatMap((p) => (p.value === null ? [] : [{ date: p.date, value: p.value }]));
  const top = Math.max(...known.map((p) => p.value));
  const best = known.filter((p) => p.value === top);
  if (known.length >= BEST_MIN && best.length === 1) {
    return { text: `${DAY_NAMES[parseLocalDate(best[0].date).getDay()]} was your best day, mood ${round1(top)}`, tone: 'good' };
  }
  const lift = lifts({ today: to, moods, hours, logs, activities, cats })[0];
  return lift ? { text: insightLine(lift), tone: lift.gap > 0 && !lift.bad ? 'good' : 'neutral' } : null;
}

/** Null when last week has nothing to say. */
export function weekRecap(args: {
  today: string;
  moods: MoodRow[];
  hours: HourRow[];
  logs: HabitLog[];
  cats: Array<Cat & { group?: string }>;
  activeIds: Set<string>;
  /** Names and categories for the fallback note. Without it, active ids stand in, named by id. */
  activities?: InsightInput['activities'];
  weights?: Array<{ date: string }>;
  stamps?: DayStamp[];
}): WeekRecap | null {
  const { today, moods, hours, logs, cats, activeIds, weights = [], stamps = [] } = args;
  const from = addDaysISO(mondayOf(today), -7);
  const to = addDaysISO(from, 6);
  const week = weekDates(from);
  const inWeek = (date: string) => date.slice(0, 10) >= from && date.slice(0, 10) <= to;

  const mw = moodWeek(moods, to);
  const sleepIds = findSleepIds(cats);
  const sleep = sleepIds.size ? avgKnown(sleepNights(hours, sleepIds, week)) : null;
  const habits = activeIds.size && logs.some((l) => inWeek(l.date)) ? habitRate(habitDays(logs, activeIds, week)) : null;
  const top = timeCompare(hours.filter((h) => !sleepIds.has(String(h.category))), cats, to, 5).top;
  const time = top ? { name: top.name, hours: top.hours } : null;
  if (mw.avg === null && sleep === null && habits === null && time === null) return null;

  const withData = new Set([...moods, ...hours, ...logs, ...weights].map((r) => r.date.slice(0, 10)));
  // Every day with data counts; an empty day before stamps existed says nothing and is left out.
  const states = week.map((d) => dayState(d, stamps, withData.has(d), today)).filter((s) => s !== null);
  const count = (state: string) => states.filter((s) => s === state).length;
  const tracked = states.length > 0;

  return {
    from,
    to,
    mood: { avg: mw.avg, delta: mw.avg !== null && mw.prevAvg !== null ? round1(mw.avg - mw.prevAvg) : null },
    sleep,
    habits,
    days: tracked ? { onTime: count('onTime'), late: count('late'), missed: count('missed') } : null,
    time,
    note: noteFor(moods, hours, logs, cats, args.activities ?? [...activeIds].map((id) => ({ id, name: id })), to),
  };
}

/** The recap as one sentence, for a small screen. */
export function recapLine(r: WeekRecap): string {
  const parts: string[] = [];
  if (r.mood.avg !== null) parts.push(`mood ${r.mood.avg}`);
  if (r.sleep !== null) parts.push(`${r.sleep}h sleep`);
  if (r.habits !== null) parts.push(`habits ${r.habits}%`);
  if (r.days) parts.push(`${r.days.onTime} of ${r.days.onTime + r.days.late + r.days.missed} days on time`);
  if (r.time) parts.push(`${r.time.name} ${r.time.hours}h`);
  return `Last week: ${parts.slice(0, 3).join(', ')}`;
}
