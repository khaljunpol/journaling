// The Overview's answers for a small screen: the same maths, fewer numbers. Pure. Relative imports only.
import { parseLocalDate } from './date.ts';
import { lastDates } from './overview.ts';
import {
  avgKnown,
  bestStreak,
  dailySeries,
  daySpan,
  findSleepIds,
  habitDays,
  habitRate,
  habitStreak,
  moodSplit,
  moodWeek,
  sleepNights,
  timeCompare,
  weekWindow,
  type Cat,
  type HabitLog,
  type HourRow,
  type MoodRow,
} from './overviewStats.ts';
import { addDaysISO } from './quickWeek.ts';

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
};

const round1 = (x: number) => Math.round(x * 10) / 10;
/** The sleep cut-off, same as the Overview. */
const SLEEP_CUT = 7;
/** A smaller mood difference reads as "about the same". */
const SAME = 0.3;
/** Habit percent points that count as a real change. */
const HABIT_SHIFT = 5;
/** Hours that count as a real change in a week. */
const TIME_SHIFT = 5;
/** Mood days a weekday needs before we say anything about it. */
const WEEKDAY_MIN = 3;
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** Mean mood per weekday over the moods given, for weekdays with enough days. */
function weekdayMeans(moods: MoodRow[], today: string): Array<{ day: string; avg: number }> {
  const sums = WEEKDAYS.map(() => ({ s: 0, n: 0 }));
  for (const p of dailySeries(moods, today, 90)) {
    if (p.value === null) continue;
    const i = parseLocalDate(p.date).getDay();
    sums[i].s += p.value;
    sums[i].n += 1;
  }
  return sums.flatMap((x, i) => (x.n >= WEEKDAY_MIN ? [{ day: WEEKDAYS[i], avg: x.s / x.n }] : []));
}

export function deviceInsights(args: {
  today: string;
  /** The last 90 days. */
  moods: MoodRow[];
  /** The last 90 days. */
  hours: HourRow[];
  logs: HabitLog[];
  cats: Array<Cat & { group?: string }>;
  activeIds: Set<string>;
}): DeviceInsights {
  const { today, moods, hours, logs, cats, activeIds } = args;
  const mw = moodWeek(moods, today);
  const sleepIds = findSleepIds(cats);
  const dates14 = lastDates(today, 14);
  const dates90 = lastDates(today, 90);
  const week = dates14.filter((d) => d >= weekWindow(today).from);

  let first = dates14[0];
  for (const l of logs) if (l.date < first) first = l.date.slice(0, 10);
  const all = habitDays(logs, activeIds, daySpan(first, today, `${Number(today.slice(0, 4)) - 1}-01-01`));

  const delta = mw.avg !== null && mw.prevAvg !== null ? round1(mw.avg - mw.prevAvg) : null;
  const sleep = sleepIds.size ? avgKnown(sleepNights(hours, sleepIds, week, today)) : null;
  const rate = habitRate(habitDays(logs, activeIds, dates14));
  const streak = activeIds.size ? habitStreak(all, today) : 0;
  const compare = timeCompare(hours.filter((h) => !sleepIds.has(String(h.category))), cats, today, 5);

  const lines: DeviceLine[] = [];

  // Why: what goes with a better mood.
  const sleepSide = new Map<string, boolean>();
  if (sleepIds.size) for (const n of sleepNights(hours, sleepIds, dates90, today)) if (n.hours !== null) sleepSide.set(n.date, n.hours >= SLEEP_CUT);
  const sleepSplit = sleepIds.size ? moodSplit(moods, sleepSide, today) : null;
  if (sleepSplit && sleepSplit.diff >= SAME) lines.push({ text: `Mood is ${sleepSplit.diff} higher after ${SLEEP_CUT}h+ sleep`, tone: 'good' });
  else if (sleepSplit && sleepSplit.diff <= -SAME) lines.push({ text: `Mood is ${Math.abs(sleepSplit.diff)} higher on shorter nights`, tone: 'neutral' });

  const habitSide = new Map<string, boolean>();
  if (activeIds.size) for (const d of habitDays(logs, activeIds, dates90)) habitSide.set(d.date, d.share >= 0.5);
  const habitSplit = activeIds.size ? moodSplit(moods, habitSide, today) : null;
  if (habitSplit && habitSplit.diff >= SAME) lines.push({ text: `Mood is ${habitSplit.diff} higher on good habit days`, tone: 'good' });

  // How this week is going.
  if (delta !== null && delta >= SAME) lines.push({ text: `Mood is up ${delta} on last week`, tone: 'good' });
  if (delta !== null && delta <= -SAME) lines.push({ text: `Mood is down ${Math.abs(delta)} on last week`, tone: 'bad' });
  if (sleep !== null) lines.push(sleep < SLEEP_CUT ? { text: `Only ${sleep}h sleep a night this week`, tone: 'bad' } : { text: `Sleeping ${sleep}h a night this week`, tone: 'good' });

  if (streak >= 3) {
    const best = bestStreak(all.filter((d) => d.date >= `${today.slice(0, 4)}-01-01`), today);
    lines.push({ text: streak >= best ? `${streak}-day habit streak, your best this year` : `${streak}-day habit streak. Best this year: ${best}`, tone: 'good' });
  }

  const before = lastDates(addDaysISO(today, -14), 14);
  const prevRate = habitRate(habitDays(logs, activeIds, before));
  const loggedBefore = logs.some((l) => l.completed && l.date >= before[0] && l.date <= before[13]);
  if (rate !== null && prevRate !== null && loggedBefore) {
    const shift = rate - prevRate;
    if (shift >= HABIT_SHIFT) lines.push({ text: `Habits up ${shift}% on the 2 weeks before`, tone: 'good' });
    if (shift <= -HABIT_SHIFT) lines.push({ text: `Habits down ${Math.abs(shift)}% on the 2 weeks before`, tone: 'bad' });
  }

  // Patterns and where the time went.
  const means = weekdayMeans(moods, today).sort((a, b) => b.avg - a.avg);
  if (means.length >= 2 && means[0].avg - means[means.length - 1].avg >= 1) {
    lines.push({ text: `${means[0].day} are your best mood days`, tone: 'good' });
    lines.push({ text: `${means[means.length - 1].day} are your lowest mood days`, tone: 'neutral' });
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
  };
}
