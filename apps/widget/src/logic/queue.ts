// Pure offline queue: taps wait here until they reach Journal.
import type { Action, DeviceState } from './api';

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
      return { ...s, habits: s.habits.map((h) => (h.id === a.activityId ? { ...h, done: true } : h)) };
    default:
      return s;
  }
}

/** Habits to draw: the picked ones in picked order, or the first ones when nothing is picked. */
export function shownHabits<T extends { id: string }>(habits: T[], picked: string[], max: number): T[] {
  const list = picked.length ? picked.flatMap((id) => habits.filter((h) => h.id === id)) : habits;
  return list.slice(0, max);
}
