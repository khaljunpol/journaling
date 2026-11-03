// Was a day logged on time, late, or not at all? Pure. Relative imports only.
import { parseLocalDate } from './date.ts';
import { addDaysISO, mondayOf } from './quickWeek.ts';

/** Stamps start here. Older days have no recorded time: with data they read as on time, empty ones have no state. */
export const TRACKING_START = '2026-11-02';

/** The parts that decide a day. Highlights, climbs and side quests don't count. */
export type StampKind = 'mood' | 'habits' | 'weight' | 'hours';
/** One row per date and kind: when that part was first logged. Never changes. */
export type DayStamp = { date: string; kind: StampKind; at: string };
export type DayState = 'onTime' | 'late' | 'missed' | 'waiting';
export type Line = { text: string; tone: 'good' | 'bad' | 'neutral' };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Days of tracking before patterns are worth saying. */
const PATTERN_DAYS = 14;
/** Tracked days this week before the week's count is worth saying. */
const WEEK_MIN = 3;
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** The UTC date of an instant, YYYY-MM-DD. The app's day always ends at UTC midnight. */
export function appDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The time to record. The tap time wins if it's believable: in the past, and at most 7 days old. */
export function stampTime(sent: number | null, now: number): string {
  const ok = sent !== null && Number.isFinite(sent) && sent <= now && now - sent <= WEEK_MS;
  return new Date(ok ? sent : now).toISOString();
}

/** Any of the four parts logged. */
export function dayHasData(day: { mood: number | null; weight: number | null; logs: unknown[]; hours: Array<number | null> }): boolean {
  return day.mood !== null || day.weight !== null || day.logs.length > 0 || day.hours.some((h) => h !== null);
}

/** Null when there is nothing to say: an empty day before `start` with no stamp, or a day still to come. */
export function dayState(date: string, stamps: DayStamp[], hasData: boolean, today: string, start = TRACKING_START): DayState | null {
  if (date > today) return null;
  const own = stamps.filter((s) => s.date === date);
  // Before stamps existed: data means on time (never accuse on missing evidence); an empty day says nothing.
  if (date < start && !own.length) return hasData ? 'onTime' : null;
  if (own.length) {
    const first = own.map((s) => s.at).reduce((a, b) => (new Date(b) < new Date(a) ? b : a));
    return appDay(new Date(first)) <= date ? 'onTime' : 'late';
  }
  // Data without a stamp means the stamp failed to save. Never call a day late on missing evidence.
  if (hasData) return 'onTime';
  return date === today ? 'waiting' : 'missed';
}

function topOf(counts: Map<string, number>, min: number): string | null {
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  // A tie is not a pattern.
  const tied = [...counts].filter(([, n]) => n === best?.[1]).length > 1;
  return best && best[1] >= min && !tied ? best[0] : null;
}

/** What late days have in common, once there are enough days to say. */
export function latePatterns(stamps: DayStamp[], hasData: (date: string) => boolean, today: string, start = TRACKING_START): string[] {
  const dates: string[] = [];
  for (let d = start; d < today; d = addDaysISO(d, 1)) dates.push(d);
  if (dates.length < PATTERN_DAYS) return [];
  const out: string[] = [];

  const byDay = new Map<string, number>();
  for (const d of dates) {
    if (dayState(d, stamps, hasData(d), today, start) !== 'late') continue;
    const name = WEEKDAYS[parseLocalDate(d).getDay()];
    byDay.set(name, (byDay.get(name) ?? 0) + 1);
  }
  const day = topOf(byDay, 2);
  if (day) out.push(`You log late most on ${day}`);

  const byKind = new Map<string, number>();
  for (const s of stamps) {
    if (s.date >= start && s.date < today && appDay(new Date(s.at)) > s.date) byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1);
  }
  const kind = topOf(byKind, 2);
  if (kind) out.push(`You forget ${kind} most`);
  return out;
}

/** Sentences about keeping up. Today is left out: it isn't over yet. */
export function lateLines(stamps: DayStamp[], hasData: (date: string) => boolean, today: string, start = TRACKING_START): Line[] {
  const dates: string[] = [];
  for (let d = start; d < today; d = addDaysISO(d, 1)) dates.push(d);
  const states = new Map(dates.map((d) => [d, dayState(d, stamps, hasData(d), today, start)]));
  const lines: Line[] = [];

  const monday = mondayOf(today);
  const week = dates.filter((d) => d >= monday);
  const missed = week.filter((d) => states.get(d) === 'missed').length;
  if (missed > 0) lines.push({ text: `${missed} ${missed === 1 ? 'day' : 'days'} to fill in this week`, tone: 'bad' });
  if (week.length >= WEEK_MIN) {
    const onTime = week.filter((d) => states.get(d) === 'onTime').length;
    const tone = onTime === week.length ? 'good' : onTime * 2 < week.length ? 'bad' : 'neutral';
    lines.push({ text: `${onTime} of ${week.length} days on time this week`, tone });
  }

  const rescued = dates.filter((d) => d.slice(0, 7) === today.slice(0, 7) && states.get(d) === 'late').length;
  if (rescued > 0) lines.push({ text: `${rescued} ${rescued === 1 ? 'day' : 'days'} rescued this month`, tone: 'good' });

  for (const text of latePatterns(stamps, hasData, today, start)) lines.push({ text, tone: 'neutral' });
  return lines;
}
