// How well logging keeps up with the days: four weeks of day states and a count per part. Pure. Relative imports only.
import { dayState, lateLines, latePatterns, TRACKING_START, type DayStamp, type DayState, type StampKind } from './dayState.ts';
import { appDay } from './timeZone.ts';
import { addDaysISO, mondayOf, weekDates } from './quickWeek.ts';

export type KeepingPart = { kind: StampKind; late: number; skipped: number };
export type KeepingUp = {
  /** The most telling sentence, then the next one. */
  lines: string[];
  /** Oldest first, Monday to Sunday. `state` is null before tracking and for days to come. */
  weeks: Array<{ monday: string; days: Array<{ date: string; state: DayState | null }> }>;
  /** Finished days in the last 30. */
  onTime: number;
  total: number;
  parts: KeepingPart[];
  patterns: string[];
};

const WEEKS = 4;
const PART_DAYS = 30;
const KINDS: StampKind[] = ['mood', 'habits', 'hours', 'weight'];

/** Null until a tracked day has finished. Days before tracking stay out: their other parts have no record. */
export function keepingUp(args: {
  today: string;
  stamps: DayStamp[];
  hasPart: (date: string, kind: StampKind) => boolean;
  start?: string;
}): KeepingUp | null {
  const { today, stamps, hasPart, start = TRACKING_START } = args;
  const hasData = (date: string) => KINDS.some((k) => hasPart(date, k));
  const stateOf = (date: string) => (date < start ? null : dayState(date, stamps, hasData(date), today, start));

  const finished: string[] = [];
  for (let i = PART_DAYS; i >= 1; i--) {
    const date = addDaysISO(today, -i);
    if (date >= start) finished.push(date);
  }
  if (!finished.length) return null;

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const monday = addDaysISO(mondayOf(today), (i - WEEKS + 1) * 7);
    return { monday, days: weekDates(monday).map((date) => ({ date, state: stateOf(date) })) };
  });
  const parts = KINDS.map((kind) => ({
    kind,
    late: finished.filter((d) => stamps.some((s) => s.date === d && s.kind === kind && appDay(new Date(s.at)) > d)).length,
    skipped: finished.filter((d) => !hasPart(d, kind)).length,
  }));
  const patterns = latePatterns(stamps, hasData, today, start);
  const said = new Set(patterns);
  const onTime = finished.filter((d) => stateOf(d) === 'onTime').length;
  const lines = lateLines(stamps, hasData, today, start).map((l) => l.text).filter((t) => !said.has(t)).slice(0, 2);
  if (!lines.length) lines.push(`${onTime} of ${finished.length} ${finished.length === 1 ? 'day' : 'days'} on time`);
  return { lines, weeks, onTime, total: finished.length, parts, patterns };
}
