// The Overview's answers for a small screen: the same maths, fewer numbers. Pure. Relative imports only.
import { dayState, lateLines, TRACKING_START, type DayStamp } from './dayState.ts';
import { insightLine, insights, SAME, SLEEP_CUT, type InsightInput } from './insights.ts';
import { lastDates } from './overview.ts';
import {
  avgKnown,
  bestStreak,
  daySpan,
  findSleepIds,
  habitDays,
  habitRate,
  habitStreakGrace,
  moodWeek,
  sleepNights,
  timeCompare,
  weekWindow,
  type Cat,
  type HabitLog,
  type HourRow,
  type MoodRow,
} from './overviewStats.ts';
import { addDaysISO, mondayOf } from './quickWeek.ts';
import { recapLine, weekRecap } from './weekRecap.ts';

export type DeviceLine = { text: string; tone: 'good' | 'bad' | 'neutral' };

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
  /** Short sentences to read, most telling first. Only what the data really shows. */
  lines: DeviceLine[];
  /** Yesterday has none of the four parts logged. */
  yesterdayMissed: boolean;
};

const round1 = (x: number) => Math.round(x * 10) / 10;
/** Habit percent points that count as a real change. */
const HABIT_SHIFT = 5;
/** Hours that count as a real change in a week. */
const TIME_SHIFT = 5;
export function deviceInsights(args: {
  today: string;
  /** The last 180 days (the insight window). */
  moods: MoodRow[];
  /** The last 180 days. */
  hours: HourRow[];
  logs: HabitLog[];
  cats: Array<Cat & { group?: string }>;
  activeIds: Set<string>;
  /** Names and categories, for the insight lines. Without it, active ids stand in, named by id. */
  activities?: InsightInput['activities'];
  /** The last 90 days. */
  weights?: Array<{ date: string }>;
  stamps?: DayStamp[];
}): DeviceInsights {
  const { today, moods, hours, logs, cats, activeIds, weights = [], stamps = [] } = args;
  const mw = moodWeek(moods, today);
  const sleepIds = findSleepIds(cats);
  const dates14 = lastDates(today, 14);
  const week = dates14.filter((d) => d >= weekWindow(today).from);

  let first = dates14[0];
  for (const l of logs) if (l.date < first) first = l.date.slice(0, 10);
  const all = habitDays(logs, activeIds, daySpan(first, today, `${Number(today.slice(0, 4)) - 1}-01-01`));

  const delta = mw.avg !== null && mw.prevAvg !== null ? round1(mw.avg - mw.prevAvg) : null;
  const sleep = sleepIds.size ? avgKnown(sleepNights(hours, sleepIds, week, today)) : null;
  const rate = habitRate(habitDays(logs, activeIds, dates14));
  const logged = new Set(logs.map((l) => l.date.slice(0, 10)));
  const { streak, waiting } = activeIds.size ? habitStreakGrace(all, logged, today) : { streak: 0, waiting: 0 };
  const compare = timeCompare(hours.filter((h) => !sleepIds.has(String(h.category))), cats, today, 5);

  const withData = new Set([...moods, ...hours, ...logs, ...weights].map((r) => r.date.slice(0, 10)));
  const hasData = (date: string) => withData.has(date);
  const yesterday = addDaysISO(today, -1);

  const lines: DeviceLine[] = [];

  // Monday opens with last week.
  const activities = args.activities ?? [...activeIds].map((id) => ({ id, name: id }));
  const recap = today === mondayOf(today) ? weekRecap({ today, moods, hours, logs, cats, activeIds, activities, weights, stamps }) : null;
  if (recap) lines.push({ text: recapLine(recap), tone: 'neutral' });

  // Why: what goes with a better mood (same rules as the Insights tab).
  const found = insights({ today, moods, hours, logs, activities, cats });
  const lift = found.lifts[0];
  // A bad habit never reads as a win.
  if (lift) lines.push({ text: insightLine(lift), tone: lift.gap > 0 && !lift.bad ? 'good' : 'neutral' });
  const next = found.nextDay[0];
  if (next) lines.push({ text: insightLine(next, true), tone: next.gap > 0 && !next.bad ? 'good' : 'neutral' });

  // How this week is going.
  if (delta !== null && delta >= SAME) lines.push({ text: `Mood is up ${delta} on last week`, tone: 'good' });
  if (delta !== null && delta <= -SAME) lines.push({ text: `Mood is down ${Math.abs(delta)} on last week`, tone: 'bad' });
  if (sleep !== null) lines.push(sleep < SLEEP_CUT ? { text: `Only ${sleep}h sleep a night this week`, tone: 'bad' } : { text: `Sleeping ${sleep}h a night this week`, tone: 'good' });

  if (streak >= 3) {
    const best = bestStreak(all.filter((d) => d.date >= `${today.slice(0, 4)}-01-01`), today);
    if (waiting > 0) lines.push({ text: `${streak}-day habit streak, ${waiting} to fill in`, tone: 'neutral' });
    else lines.push({ text: streak >= best ? `${streak}-day habit streak, your best this year` : `${streak}-day habit streak. Best this year: ${best}`, tone: 'good' });
  }

  const before = lastDates(addDaysISO(today, -14), 14);
  const prevRate = habitRate(habitDays(logs, activeIds, before));
  const loggedBefore = logs.some((l) => l.completed && l.date >= before[0] && l.date <= before[13]);
  if (rate !== null && prevRate !== null && loggedBefore) {
    const shift = rate - prevRate;
    if (shift >= HABIT_SHIFT) lines.push({ text: `Habits up ${shift}% on the 2 weeks before`, tone: 'good' });
    if (shift <= -HABIT_SHIFT) lines.push({ text: `Habits down ${Math.abs(shift)}% on the 2 weeks before`, tone: 'bad' });
  }

  // Count from the first day with data, not from when stamps started.
  const dataStart = [...withData].reduce((a, b) => (b < a ? b : a), TRACKING_START);
  lines.push(...lateLines(stamps, hasData, today, dataStart));

  // Patterns and where the time went.
  if (found.rhythm) {
    lines.push({ text: `${found.rhythm.best.day}s are your best mood days`, tone: 'good' });
    lines.push({ text: `${found.rhythm.low.day}s are your lowest mood days`, tone: 'neutral' });
  }
  const top = compare.top;
  if (top && top.delta >= TIME_SHIFT) lines.push({ text: `${top.name} is up ${top.delta}h on last week`, tone: 'neutral' });
  if (top && top.delta <= -TIME_SHIFT) lines.push({ text: `${top.name} is down ${Math.abs(top.delta)}h on last week`, tone: 'neutral' });

  return {
    mood: { avg: mw.avg, delta },
    sleep,
    habits: { rate, streak },
    time: top ? { name: top.name, hours: top.hours } : null,
    lines,
    yesterdayMissed: dayState(yesterday, stamps, hasData(yesterday), today) === 'missed',
  };
}
