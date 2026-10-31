// Talks to Journal's /api/widget. No React Native imports, so tests can load it.

import type { WidgetRequest, WidgetState } from '@journaling/core/widgetState';

export type Conn = { url: string; key: string };
export type Action = WidgetRequest;
export type { WidgetState };
export type Result =
  | { kind: 'ok'; state: WidgetState; reason?: 'no_template' | 'all_filled' }
  | { kind: 'key' } // refused: show "Key not valid"
  | { kind: 'gone' } // the habit no longer exists
  | { kind: 'bad' } // the server refuses this action for good
  | { kind: 'retry' }; // no signal or a server hiccup: keep it for later

const TIMEOUT_MS = 8000;

/** The code from Journal → Settings → Widget. Null for anything else. */
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
  const body = (await res.json()) as WidgetState & { reason?: 'no_template' | 'all_filled' };
  return { kind: 'ok', state: body, reason: body.reason };
}

async function call(conn: Conn, init: RequestInit): Promise<Result> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${conn.url}/api/widget`, {
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
export const postAction = (conn: Conn, action: Action) => call(conn, { method: 'POST', body: JSON.stringify(action) });
