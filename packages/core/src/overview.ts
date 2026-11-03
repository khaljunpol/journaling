// Pure numbers for Overview and Trends. Only relative .ts imports of other pure libs, so tests can load it.
import { categoryOf, type HabitCategory } from './habitCategory.ts';
import { addDaysISO } from './quickWeek.ts';

/** The last `n` dates up to and including `today`, oldest first. */
export function lastDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysISO(today, i - (n - 1)));
}

export type TimeSlice = { id: string; name: string; color: string; hours: number };

/** Hours per category in [from, to]. The biggest `max` slices stay; the rest merge into "Other". */
export function timeSplit(
  entries: Array<{ date: string; category: number | string }>,
  cats: Array<{ id: string | number; name: string; color: string }>,
  from: string,
  to: string,
  max = 5,
): { slices: TimeSlice[]; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    const id = String(e.category);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    total += 1;
  }
  const all: TimeSlice[] = [...counts.entries()]
    .map(([id, hours]) => {
      const c = cats.find((x) => String(x.id) === id);
      return { id, name: c?.name ?? 'Other', color: c?.color ?? '#7A84A0', hours };
    })
    .sort((a, b) => b.hours - a.hours);
  if (all.length <= max) return { slices: all, total };
  const rest = all.slice(max).reduce((a, s) => a + s.hours, 0);
  return { slices: [...all.slice(0, max), { id: 'other', name: 'Other', color: '#7A84A0', hours: rest }], total };
}

export type HabitGridRow = { id: string; name: string; done: boolean[]; rate30: number; bad: boolean };

/**
 * Per-day habit grid for Trends. `days` is oldest first. One row per habit, sorted by the
 * last-30-days rate (most often done first), bad habits last. Also gives the good-habit rate for the last 7 days
 * and the 7 days before that. A habit counts as done only when a log says completed.
 */
export function habitGrid(
  habits: Array<{ id: string; name: string; category?: HabitCategory }>,
  logs: Array<{ date: string; activityId: string; completed: boolean }>,
  days: string[],
): { rows: HabitGridRow[]; week: number; prevWeek: number } {
  const done = new Set(logs.filter((l) => l.completed).map((l) => `${l.date}|${l.activityId}`));
  const rows = habits.map((h) => {
    const flags = days.map((d) => done.has(`${d}|${h.id}`));
    const last30 = flags.slice(-30);
    const rate30 = last30.length ? Math.round((last30.filter(Boolean).length / last30.length) * 100) : 0;
    return { id: h.id, name: h.name, done: flags, rate30, bad: categoryOf(h) === 'bad' };
  });
  rows.sort((a, b) => Number(a.bad) - Number(b.bad) || b.rate30 - a.rate30 || a.name.localeCompare(b.name));
  const good = rows.filter((r) => !r.bad);
  const rate = (from: number, to: number) => {
    const cells = good.length * (to - from);
    if (cells <= 0) return 0;
    const hit = good.reduce((s, r) => s + r.done.slice(from, to).filter(Boolean).length, 0);
    return Math.round((hit / cells) * 100);
  };
  const n = days.length;
  return { rows, week: rate(Math.max(0, n - 7), n), prevWeek: rate(Math.max(0, n - 14), Math.max(0, n - 7)) };
}
