// The Overview's answers for a small screen: the same maths, fewer numbers. Pure. Relative imports only.
import { lastDates } from './overview.ts';
import {
  avgKnown,
  daySpan,
  findSleepIds,
  habitDays,
  habitRate,
  habitStreak,
  moodWeek,
  sleepNights,
  timeCompare,
  weekWindow,
  type Cat,
  type HabitLog,
  type HourRow,
  type MoodRow,
} from './overviewStats.ts';

/** Only with GET /api/device?include=insights. A null means there is nothing to show yet. */
export type DeviceInsights = {
  /** This week's mean, and the change from the same days last week. */
  mood: { avg: number | null; delta: number | null };
  /** Mean hours a night this week. */
  sleep: number | null;
  /** Percent done over 14 days, and days in a row. */
  habits: { rate: number | null; streak: number };
  /** The biggest use of time this week, sleep left out. */
  time: { name: string; hours: number } | null;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

export function deviceInsights(args: {
  today: string;
  moods: MoodRow[];
  hours: HourRow[];
  logs: HabitLog[];
  cats: Array<Cat & { group?: string }>;
  activeIds: Set<string>;
}): DeviceInsights {
  const { today, moods, hours, logs, cats, activeIds } = args;
  const mw = moodWeek(moods, today);
  const sleepIds = findSleepIds(cats);
  const dates14 = lastDates(today, 14);
  const week = dates14.filter((d) => d >= weekWindow(today).from);

  let first = dates14[0];
  for (const l of logs) if (l.date < first) first = l.date.slice(0, 10);
  const all = habitDays(logs, activeIds, daySpan(first, today, `${Number(today.slice(0, 4)) - 1}-01-01`));

  const top = timeCompare(hours.filter((h) => !sleepIds.has(String(h.category))), cats, today, 5).top;
  return {
    mood: { avg: mw.avg, delta: mw.avg !== null && mw.prevAvg !== null ? round1(mw.avg - mw.prevAvg) : null },
    sleep: sleepIds.size ? avgKnown(sleepNights(hours, sleepIds, week, today)) : null,
    habits: { rate: habitRate(habitDays(logs, activeIds, dates14)), streak: activeIds.size ? habitStreak(all, today) : 0 },
    time: top ? { name: top.name, hours: top.hours } : null,
  };
}
