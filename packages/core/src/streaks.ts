// Per-habit streaks with freezes. Good habits only: a broken "days without" count is pure guilt. Pure. Relative imports only.
import { categoryOf, type HabitCategory } from './habitCategory.ts';
import type { HabitLog } from './overviewStats.ts';
import { templateKind } from './quickDay.ts';
import { addDaysISO, mondayOf } from './quickWeek.ts';

export type Streak = {
  id: string;
  name: string;
  /** On a usual list: days. On no list: weeks (Monday to Sunday). */
  unit: 'days' | 'weeks';
  current: number;
  best: number;
  /** Freezes held now, 0 to 2. */
  freezes: number;
  /** Units a freeze covered (a date, or a week's Monday). */
  usedFreezes: string[];
};

/** A closed unit older than this many days can use a freeze. Newer ones can still be filled in. */
const WINDOW = 7;
const START_FREEZES = 1;
const MAX_FREEZES = 2;
/** Kept units per new freeze. */
const EARN = { days: 7, weeks: 4 } as const;

type Unit = { key: string; listed: boolean; done: boolean; closed: boolean };

function walk(units: Unit[], unit: 'days' | 'weeks') {
  let current = 0;
  let best = 0;
  let freezes = START_FREEZES;
  let kept = 0;
  const used: string[] = [];
  for (const u of units) {
    if (u.done) {
      current += 1;
      best = Math.max(best, current);
      kept += 1;
      if (kept % EARN[unit] === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      continue;
    }
    // Off the list, or still open (can be filled in): neither adds nor ends.
    if (!u.listed || !u.closed) continue;
    if (freezes > 0) {
      freezes -= 1;
      used.push(u.key);
      continue;
    }
    // Out of freezes: the streak restarts. The best stays.
    current = 0;
    kept = 0;
    freezes = START_FREEZES;
  }
  return { current, best, freezes, usedFreezes: used };
}

/** Every good habit with any row, best current streak first. */
export function habitStreaks(args: {
  logs: HabitLog[];
  activities: Array<{ id: string; name: string; category?: HabitCategory }>;
  templates: { weekday: string[] | null; weekend: string[] | null };
  today: string;
}): Streak[] {
  const { logs, activities, templates, today } = args;
  const lastClosed = addDaysISO(today, -WINDOW - 1);
  const first = new Map<string, string>();
  const doneOn = new Map<string, Set<string>>();
  for (const l of logs) {
    const d = l.date.slice(0, 10);
    if (d > today) continue;
    if (!first.has(l.activityId) || d < (first.get(l.activityId) as string)) first.set(l.activityId, d);
    if (!l.completed) continue;
    const s = doneOn.get(l.activityId) ?? new Set<string>();
    s.add(d);
    doneOn.set(l.activityId, s);
  }
  const listedOn = (id: string, date: string) => (templates[templateKind(date)] ?? []).includes(id);
  const onAnyList = (id: string) => [...(templates.weekday ?? []), ...(templates.weekend ?? [])].includes(id);

  const out: Streak[] = [];
  for (const a of activities) {
    const start = first.get(a.id);
    if (!start || categoryOf(a) === 'bad') continue;
    const done = doneOn.get(a.id) ?? new Set<string>();
    const unit = onAnyList(a.id) ? 'days' : 'weeks';
    const units: Unit[] = [];
    if (unit === 'days') {
      for (let d = start; d <= today; d = addDaysISO(d, 1)) units.push({ key: d, listed: listedOn(a.id, d), done: done.has(d), closed: d <= lastClosed });
    } else {
      for (let m = mondayOf(start); m <= today; m = addDaysISO(m, 7)) {
        const days = Array.from({ length: 7 }, (_, i) => addDaysISO(m, i));
        units.push({ key: m, listed: true, done: days.some((d) => done.has(d)), closed: days[6] <= lastClosed });
      }
    }
    out.push({ id: a.id, name: a.name, unit, ...walk(units, unit) });
  }
  return out.sort((x, y) => y.current - x.current || y.best - x.best);
}
