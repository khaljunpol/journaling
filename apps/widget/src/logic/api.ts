// Talks to Journal's /api/device. No React Native imports, so tests can load it.

import type { DeviceClimb } from '@journaling/core/deviceClimb';
import type { DeviceInsights } from '@journaling/core/deviceInsights';
import type { DeviceHistoryDay, DeviceHours, DeviceRequest, DeviceState, DeviceWeekDay } from '@journaling/core/deviceState';
import type { DeviceGame } from '@journaling/core/game';
import type { DeviceWorld } from '@journaling/core/world';

export type Conn = { url: string; key: string };
export type Action = DeviceRequest;
export type { DeviceClimb, DeviceGame, DeviceHistoryDay, DeviceHours, DeviceInsights, DeviceState, DeviceWeekDay, DeviceWorld };
export type Result =
  | { kind: 'ok'; state: DeviceState; reason?: 'no_template' | 'all_filled' }
  | { kind: 'key' } // refused: show "Key not valid"
  | { kind: 'gone' } // the habit no longer exists
  | { kind: 'bad' } // the server refuses this action for good
  | { kind: 'retry' }; // no signal or a server hiccup: keep it for later

const TIMEOUT_MS = 8000;

/** The code from Journal → Settings → Devices. Null for anything else. */
export function connFromCode(code: string): Conn | null {
  try {
    const v = JSON.parse(atob(code.trim())) as { url?: unknown; key?: unknown };
    if (typeof v.url !== 'string' || typeof v.key !== 'string' || !v.url || !v.key) return null;
    if (!/^https?:\/\//.test(v.url)) return null;
    return { url: v.url.replace(/\/+$/, ''), key: v.key };
  } catch {
    return null;
  }
}

async function readResult(res: Response): Promise<Result> {
  if (res.status === 401) return { kind: 'key' };
  if (res.status === 404) return { kind: 'gone' };
  if (res.status >= 500 || res.status === 429) return { kind: 'retry' };
  if (!res.ok) return { kind: 'bad' };
  const body = (await res.json()) as DeviceState & { reason?: 'no_template' | 'all_filled' };
  return { kind: 'ok', state: body, reason: body.reason };
}

async function call(conn: Conn, init: RequestInit): Promise<Result> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${conn.url}/api/device`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${conn.key}`, 'Content-Type': 'application/json' },
    });
    return await readResult(res);
  } catch {
    return { kind: 'retry' };
  } finally {
    clearTimeout(t);
  }
}

export const getState = (conn: Conn) => call(conn, { method: 'GET' });

/** Categories and today's hour slots, for the Hours window. Null when they can't be read now. */
export async function getHours(conn: Conn): Promise<DeviceHours | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=hours`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as Partial<DeviceHours>;
    // An older server answers without these: treat it as "can't read now" instead of crashing the window.
    if (!Array.isArray(v.categories) || !Array.isArray(v.slots)) return null;
    return { categories: v.categories, slots: v.slots };
  } catch {
    return null;
  }
}

/** Monday to Sunday, for the week widget. Null when it can't be read now, or the server is older. */
export async function getWeek(conn: Conn): Promise<DeviceWeekDay[] | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=week`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as { week?: unknown };
    return Array.isArray(v.week) ? (v.week as DeviceWeekDay[]) : null;
  } catch {
    return null;
  }
}

/** The last 30 days of mood and weight. Null when it can't be read now, or the server is older. */
export async function getHistory(conn: Conn): Promise<DeviceHistoryDay[] | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=history`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as { history?: unknown };
    return Array.isArray(v.history) ? (v.history as DeviceHistoryDay[]) : null;
  } catch {
    return null;
  }
}

/** The Overview's answers. Null when they can't be read now, or the server is older. */
export async function getInsights(conn: Conn): Promise<DeviceInsights | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=insights`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as { insights?: DeviceInsights };
    return v.insights ?? null;
  } catch {
    return null;
  }
}

/** The climbing numbers. Null when they can't be read now, or the server is older. */
export async function getClimb(conn: Conn): Promise<DeviceClimb | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=climb`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as { climb?: DeviceClimb };
    return v.climb ?? null;
  } catch {
    return null;
  }
}

/** Level, points and the best streak. Null when they can't be read now, or the server is older. */
export async function getGame(conn: Conn): Promise<DeviceGame | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=game`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as { game?: DeviceGame };
    return v.game ?? null;
  } catch {
    return null;
  }
}

/** The valley's still picture. Null when it can't be read now, or the server is older. */
export async function getWorld(conn: Conn): Promise<DeviceWorld | null> {
  try {
    const res = await fetch(`${conn.url}/api/device?include=world`, { headers: { Authorization: `Bearer ${conn.key}` } });
    if (!res.ok) return null;
    const v = (await res.json()) as { world?: DeviceWorld };
    return v.world ?? null;
  } catch {
    return null;
  }
}

export const postAction = (conn: Conn, action: Action) => call(conn, { method: 'POST', body: JSON.stringify(action) });
