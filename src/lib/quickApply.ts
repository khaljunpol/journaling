// Pure helpers for the /quick board: apply outbox items on top of a payload, and find queue items per tile.
import type { QuickPayload } from './quickPayload.ts';
import type { ItemKey } from './quickDay.ts';

export type QueueLike = { key: string; body: unknown; state: 'pending' | 'failed' };

const TILE_PREFIX: Record<string, string> = {
  mood: 'mood:',
  weight: 'weight:',
  highlight: 'highlight:',
  hours: 'hours:',
  habits: 'log:',
  sidequests: 'sq:',
};

/** Queue items that belong to one tile on one date. */
export function itemsForTile<T extends { key: string }>(queue: T[], tile: ItemKey, date: string): T[] {
  const p = TILE_PREFIX[tile];
  if (!p) return [];
  const start = `${p}${date}`;
  return queue.filter((q) => q.key === start || q.key.startsWith(`${start}:`));
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Returns a new payload with one queue item applied. Unknown keys or days leave it unchanged. */
export function applyQueueItem(payload: QuickPayload, item: QueueLike): QuickPayload {
  const parts = item.key.split(':');
  const kind = parts[0];
  const date = parts[1];
  const day = payload.days[date];
  if (!day) return payload;
  const body = rec(item.body);
  let next = day;
  if (kind === 'mood' && typeof body.score === 'number') {
    next = { ...day, mood: body.score };
  } else if (kind === 'weight' && typeof body.weight === 'number') {
    next = { ...day, weight: body.weight };
  } else if (kind === 'highlight' && typeof body.text === 'string') {
    next = { ...day, highlight: body.text };
  } else if (kind === 'log' && parts[2]) {
    const activityId = parts.slice(2).join(':');
    const logs = day.logs.filter((l) => l.activityId !== activityId);
    logs.push({ activityId, completed: body.completed === true });
    next = { ...day, logs };
  } else if (kind === 'hours' && Array.isArray(body.entries)) {
    const hours = day.hours.slice();
    for (const e of body.entries as Array<Record<string, unknown>>) {
      const h = Number(e?.hour);
      if (Number.isInteger(h) && h >= 0 && h < 24 && typeof e?.category === 'number') hours[h] = e.category;
    }
    next = { ...day, hours };
  } else if (kind === 'sq' && parts[2]) {
    const id = parts.slice(2).join(':');
    if (!day.sidequestLogIds.includes(id)) next = { ...day, sidequestLogIds: [...day.sidequestLogIds, id] };
  }
  if (next === day) return payload;
  return { ...payload, days: { ...payload.days, [date]: next } };
}

export function applyQueue(payload: QuickPayload, queue: QueueLike[]): QuickPayload {
  return queue.reduce(applyQueueItem, payload);
}

/** Hour entries to send: only slots that have a category (the API rejects null). */
export function hoursEntries(hours: Array<number | null>): Array<{ hour: number; category: number }> {
  const out: Array<{ hour: number; category: number }> = [];
  hours.forEach((category, hour) => {
    if (category !== null) out.push({ hour, category });
  });
  return out;
}

/** Copy of the payload with days older than `keepDays` before `today` removed (for the phone snapshot). */
export function pruneDays(payload: QuickPayload, today: string, keepDays = 21): QuickPayload {
  const [y, m, d] = today.split('-').map(Number);
  const cut = new Date(Date.UTC(y, m - 1, d - keepDays)).toISOString().slice(0, 10);
  const days = Object.fromEntries(Object.entries(payload.days).filter(([date]) => date >= cut));
  return { ...payload, days };
}
