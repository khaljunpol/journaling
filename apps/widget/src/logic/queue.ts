// Pure offline queue: taps wait here until they reach Journal.
import { HISTORY_DAYS } from '@journaling/core/deviceState';
import { addDaysISO, mondayOf, weekDates } from '@journaling/core/quickWeek';
import type { Action, DeviceHistoryDay, DeviceState, DeviceWeekDay } from './api';

/** `date` is the day the tap was made for. The server always saves to its own today. */
export type QueueItem = { id: string; action: Action; date: string };

/** Repeating the same mood, weight or hours tap replaces the waiting one; each habit keeps its own. */
function sameTarget(a: Action, b: Action): boolean {
  if (a.action !== b.action) return false;
  return a.action === 'habit' && b.action === 'habit' ? a.activityId === b.activityId : true;
}

export function enqueue(q: QueueItem[], item: QueueItem): QueueItem[] {
  return [...q.filter((x) => !sameTarget(x.action, item.action)), item];
}

/** Only taps made for the server's today are sent: yesterday's offline tap must not land on today. */
export function sendable(q: QueueItem[], today: string): QueueItem[] {
  return q.filter((x) => x.date === today);
}

export function remove(q: QueueItem[], id: string): QueueItem[] {
  return q.filter((x) => x.id !== id);
}

/** What the widget shows right after a tap. Hours wait for the server's answer. */
export function applyLocal(s: DeviceState, a: Action): DeviceState {
  switch (a.action) {
    case 'mood':
      return { ...s, mood: a.score };
    case 'weight':
      return { ...s, weight: a.weight };
    case 'habit':
      return { ...s, habits: s.habits.map((h) => (h.id === a.activityId ? { ...h, done: a.done !== false } : h)) };
    case 'highlight':
      return { ...s, highlight: a.text };
    default:
      return s;
  }
}

/**
 * Habits to draw: the picked ones in order, or the first ones when nothing is picked.
 * A habit done today that isn't there takes the last slot that isn't done, so the widget shows what you did.
 */
export function shownHabits<T extends { id: string; done?: boolean }>(habits: T[], picked: string[], max: number): T[] {
  const list = picked.length ? picked.flatMap((id) => habits.filter((h) => h.id === id)) : habits;
  const out = list.slice(0, max);
  const extras = habits.filter((h) => h.done && !out.some((x) => x.id === h.id));
  for (const extra of extras) {
    let i = out.length - 1;
    while (i >= 0 && out[i].done) i--;
    if (i >= 0) out[i] = extra;
    else if (out.length < max) out.push(extra);
  }
  return out;
}

/** This week, Monday first. Today follows the live progress, so a tap shows at once. A day with no data is 0 of 0. */
export function shownWeek(week: DeviceWeekDay[] | null, state: DeviceState): DeviceWeekDay[] {
  return weekDates(mondayOf(state.date)).map((date) =>
    date === state.date ? { date, ...state.progress } : (week?.find((d) => d.date === date) ?? { date, filled: 0, total: 0 }),
  );
}

/** The last 30 days, oldest first. Today follows the live values, so a tap shows at once. */
export function shownHistory(history: DeviceHistoryDay[] | null, state: DeviceState): DeviceHistoryDay[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = addDaysISO(state.date, i + 1 - HISTORY_DAYS);
    if (date === state.date) return { date, mood: state.mood, weight: state.weight };
    return history?.find((d) => d.date === date) ?? { date, mood: null, weight: null };
  });
}

/** Points for a trend line: x by position, lowest value at the bottom. Gaps are skipped. Equal values sit in the middle. */
export function sparkPoints(values: Array<number | null>, w: number, h: number): Array<{ x: number; y: number }> {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) return [];
  const min = Math.min(...known);
  const range = Math.max(...known) - min;
  const last = values.length - 1;
  return values.flatMap((v, i) =>
    v === null ? [] : [{ x: last > 0 ? (i / last) * w : w, y: range > 0 ? h - ((v - min) / range) * h : h / 2 }],
  );
}

/** The sentence to show. `at` only ever grows, so it wraps around the list. */
export function shownLine<T>(lines: T[] | undefined, at: number): T | null {
  return lines?.length ? lines[at % lines.length] : null;
}
