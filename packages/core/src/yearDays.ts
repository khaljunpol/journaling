// The year calendar: one small tuple per day, its colour per layer, and the header numbers. Pure. Relative imports only.
import { goodIds } from './habitCategory.ts';
import { firstSeen, type InsightInput } from './insights.ts';
import { moodColor, moodLabel } from './mood.ts';
import { findSleepIds, hm, sleepNights } from './overviewStats.ts';
import { addDaysISO } from './quickWeek.ts';
import { MAX_DAY } from './scoring.ts';

/** [mood, share of good habits done, sleep hours, points, perfect]. Points and perfect are null without game data. */
export type DayTuple = [mood: number | null, habitShare: number | null, sleepHours: number | null, points: number | null, perfect?: boolean | null];
export type Layer = 'mood' | 'habits' | 'sleep' | 'points';

const day = (iso: string) => iso.slice(0, 10);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Every date of `year` up to today with any value. Reads need 31 Dec of the year before, for the first night. */
export function yearDays(year: number, input: InsightInput, points?: Map<string, { points: number; perfect: boolean }>): Record<string, DayTuple> {
  const { today, moods, hours, logs, activities, cats } = input;
  const first = `${year}-01-01`;
  const last = `${year}-12-31` < today ? `${year}-12-31` : today;
  const dates: string[] = [];
  for (let d = first; d <= last; d = addDaysISO(d, 1)) dates.push(d);
  const inYear = (d: string) => d >= first && d <= last;

  const moodSum = new Map<string, { s: number; n: number }>();
  for (const m of moods) {
    const d = day(m.date);
    const v = Number(m.score);
    if (!inYear(d) || String(m.score).trim() === '' || !Number.isFinite(v)) continue;
    const e = moodSum.get(d) ?? { s: 0, n: 0 };
    e.s += v;
    e.n += 1;
    moodSum.set(d, e);
  }

  const known = new Set(activities.map((a) => a.id));
  const good = goodIds(activities);
  const logged = new Set<string>();
  const doneGood = new Map<string, Set<string>>();
  for (const l of logs) {
    const d = day(l.date);
    if (!inYear(d) || !known.has(l.activityId)) continue;
    logged.add(d);
    if (!l.completed || !good.has(l.activityId)) continue;
    const s = doneGood.get(d) ?? new Set<string>();
    s.add(l.activityId);
    doneGood.set(d, s);
  }

  // A day's share counts only the good habits that existed by then (first row on or before it).
  const seen = firstSeen(logs, today);
  const goodBy = (d: string) => [...good].filter((id) => (seen.get(id) ?? '9') <= d).length;

  const sleepIds = findSleepIds(cats);
  const sleep = new Map<string, number>();
  if (sleepIds.size) for (const n of sleepNights(hours, sleepIds, dates, today)) if (n.hours !== null) sleep.set(n.date, n.hours);

  const out: Record<string, DayTuple> = {};
  for (const d of dates) {
    const m = moodSum.get(d);
    const t: DayTuple = [
      m ? round1(m.s / m.n) : null,
      logged.has(d) && goodBy(d) ? (doneGood.get(d)?.size ?? 0) / goodBy(d) : null,
      sleep.get(d) ?? null,
      points?.get(d)?.points ?? null,
      points?.get(d)?.perfect ?? null,
    ];
    if (t[0] !== null || t[1] !== null || t[2] !== null || (t[3] ?? 0) > 0) out[d] = t;
  }
  return out;
}

/** Days with a mood or habit rows, and the month (0..11) with the best mean mood over 4+ moods. */
export function yearSummary(days: Record<string, DayTuple>): { logged: number; bestMonth: number | null } {
  let logged = 0;
  const months = Array.from({ length: 12 }, () => ({ s: 0, n: 0 }));
  for (const [d, [mood, share]] of Object.entries(days)) {
    if (mood !== null || share !== null) logged += 1;
    if (mood === null) continue;
    const m = Number(d.slice(5, 7)) - 1;
    months[m].s += mood;
    months[m].n += 1;
  }
  let bestMonth: number | null = null;
  months.forEach((m, i) => {
    if (m.n >= 4 && (bestMonth === null || m.s / m.n > months[bestMonth].s / months[bestMonth].n)) bestMonth = i;
  });
  return { logged, bestMonth };
}

const step = (base: string, n: number) => `color-mix(in srgb, ${base} ${n}%, var(--surface-3))`;

/** The cell's colour and label on a layer. null = no data (the cell uses --surface-3). */
export function layerCell(layer: Layer, date: string, t: DayTuple | undefined): { color: string; label: string } | null {
  if (!t) return null;
  const [mood, share, sleep, pts, perfect] = t;
  if (layer === 'mood' && mood !== null) return { color: moodColor(mood), label: `${date}: ${moodLabel(mood)} (${mood}/10)` };
  if (layer === 'habits' && share !== null) {
    const n = share < 0.25 ? 25 : share < 0.5 ? 50 : share < 0.75 ? 75 : 100;
    return { color: step('var(--accent)', n), label: `${date}: ${Math.round(share * 100)}% of habits` };
  }
  if (layer === 'sleep' && sleep !== null) {
    const n = sleep < 6 ? 25 : sleep < 7 ? 50 : sleep < 8 ? 75 : 100;
    return { color: step('#38BDF8', n), label: `${date}: ${hm(sleep)} sleep` };
  }
  if (layer === 'points' && pts !== null && pts !== undefined && pts > 0) {
    if (perfect) return { color: 'var(--reward)', label: `${date}: perfect day, ${pts} points` };
    const r = pts / MAX_DAY;
    const n = r < 0.25 ? 25 : r < 0.5 ? 50 : r < 0.75 ? 75 : 100;
    return { color: step('var(--accent)', n), label: `${date}: ${pts} points` };
  }
  return null;
}
