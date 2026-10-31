// Climbing for a small screen: the climbing page's maths, fewer numbers. Pure. Relative imports only.
import { goalPace, hardestSend, weekStreak, type GoalSpec, type Log } from './climbStats.ts';
import type { DeviceLine } from './deviceInsights.ts';
import { climbWeek } from './overviewStats.ts';

/** Only with GET /api/device?include=climb. */
export type DeviceClimb = {
  /** Sessions this week. */
  sessions: number;
  /** Days since the last climb. Null when nothing is logged. */
  daysSince: number | null;
  /** Hardest send this year, boulder first. */
  hardest: string | null;
  /** Weeks in a row with a climb. */
  weeks: number;
  /** Short sentences for the insight widget. */
  lines: DeviceLine[];
};

/** Days without a climb before it's worth saying. */
const LONG_GAP = 14;
const MIN_WEEKS = 3;

export function deviceClimb(logs: Log[], goals: GoalSpec[], today: string): DeviceClimb {
  const past = logs.filter((l) => l.date.slice(0, 10) <= today);
  const { sessions, daysSince } = climbWeek(past, today);
  const year = today.slice(0, 4);
  const thisYear = past.filter((l) => l.date.startsWith(year));
  const hardest = (hardestSend(thisYear, 'boulder') ?? hardestSend(thisYear, 'rope'))?.grade ?? null;
  const weeks = weekStreak(past, today);

  const lines: DeviceLine[] = [];
  if (weeks >= MIN_WEEKS) lines.push({ text: `${weeks} weeks of climbing in a row`, tone: 'good' });
  if (daysSince !== null && daysSince >= LONG_GAP) lines.push({ text: `${daysSince} days since your last climb`, tone: 'bad' });
  for (const g of goals.filter((x) => x.year === Number(year) && x.target > 0)) {
    const pace = goalPace(g, logs, today);
    if (pace.done >= g.target) lines.push({ text: `${g.grade} goal done: ${pace.done} of ${g.target}`, tone: 'good' });
    else if (pace.onTrack) lines.push({ text: `On track for ${g.target} ${g.grade} sends`, tone: 'good' });
    else lines.push({ text: `Behind on ${g.grade} goal: ${pace.done} of ${g.target}`, tone: 'bad' });
  }
  return { sessions, daysSince, hardest, weeks, lines };
}
