// Pure offline outbox for the /quick check-in. No imports, no window, no clock: `now` is always a parameter.

export type OutboxItem = {
  key: string;
  url: string;
  method: 'POST' | 'PUT';
  body: unknown;
  attempts: number;
  nextAt: number;
  state: 'pending' | 'failed';
  /** When this body was enqueued. Used to pick the newer copy when tabs merge. */
  updatedAt: number;
  /** Made before the session was confirmed. Never sent until the same user is confirmed. */
  unconfirmed?: boolean;
};

export type Outcome = 'done' | 'retry' | 'failed' | 'auth';

/** 2s, 4s, 8s ... capped at 5 minutes. `attempts` is the number of tries so far (>= 1). */
export function backoffMs(attempts: number): number {
  const n = Math.max(1, Math.floor(attempts));
  if (n > 20) return 300000;
  return Math.min(300000, 1000 * 2 ** n);
}

export function classify(status: number | 'network'): Outcome {
  if (status === 'network') return 'retry';
  if (status >= 200 && status < 300) return 'done';
  if (status === 401 || status === 403) return 'auth';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'failed';
}

/** Add an item. The same key replaces the old one (new body, attempts reset, due now). */
export function enqueue(
  q: OutboxItem[],
  item: Omit<OutboxItem, 'attempts' | 'nextAt' | 'state' | 'updatedAt'>,
  now: number,
): OutboxItem[] {
  const next: OutboxItem = { ...item, attempts: 0, nextAt: now, state: 'pending', updatedAt: now };
  const i = q.findIndex((x) => x.key === item.key);
  if (i === -1) return [...q, next];
  return q.map((x, j) => (j === i ? next : x));
}

/** Apply a send result. done removes, retry backs off, failed is kept (not dropped), auth changes nothing. */
export function onResult(q: OutboxItem[], key: string, result: Outcome, now: number): OutboxItem[] {
  if (result === 'auth') return q;
  if (result === 'done') return q.filter((x) => x.key !== key);
  return q.map((x) => {
    if (x.key !== key) return x;
    const attempts = x.attempts + 1;
    if (result === 'failed') return { ...x, attempts, state: 'failed' as const };
    return { ...x, attempts, nextAt: now + backoffMs(attempts), state: 'pending' as const };
  });
}

/** Items ready to send now: pending and past their nextAt. */
export function due(q: OutboxItem[], now: number): OutboxItem[] {
  return q.filter((x) => x.state === 'pending' && x.nextAt <= now);
}

/**
 * Three-way merge of two tabs sharing one stored queue.
 * stored = what is in storage now, local = this tab's queue, base = what this tab last read or wrote.
 * - Only in one side and not in base: new there, keep.
 * - In base and unchanged but gone from the other side: finished there, drop.
 * - In both: the newer updatedAt wins; on a tie local wins (it holds the attempt progress).
 */
export function mergeQueues(stored: OutboxItem[], local: OutboxItem[], base: OutboxItem[]): OutboxItem[] {
  const b = new Map(base.map((x) => [x.key, x]));
  const s = new Map(stored.map((x) => [x.key, x]));
  const l = new Map(local.map((x) => [x.key, x]));
  const out: OutboxItem[] = [];
  const seen = new Set<string>();
  for (const x of [...stored, ...local]) {
    if (seen.has(x.key)) continue;
    seen.add(x.key);
    const si = s.get(x.key);
    const li = l.get(x.key);
    const bi = b.get(x.key);
    if (si && li) {
      out.push(si.updatedAt > li.updatedAt ? si : li);
    } else if (si) {
      if (!(bi && bi.updatedAt === si.updatedAt)) out.push(si);
    } else if (li) {
      if (!(bi && bi.updatedAt === li.updatedAt)) out.push(li);
    }
  }
  return out;
}

/** The base for the next merge: the last queue that was really persisted. A failed write keeps the old base. */
export function nextBase(prevBase: OutboxItem[], merged: OutboxItem[], persisted: boolean): OutboxItem[] {
  return persisted ? merged : prevBase;
}

/**
 * Settle taps made before the session was confirmed.
 * Same user confirmed: clear the flag so they can be sent. Another user confirmed: drop them (they were
 * made by the person now signed in), keep older confirmed items.
 */
export function settleUnconfirmed(q: OutboxItem[], sameUser: boolean): OutboxItem[] {
  if (!sameUser) return q.filter((x) => !x.unconfirmed);
  return q.map((x) => {
    if (!x.unconfirmed) return x;
    const rest = { ...x };
    delete rest.unconfirmed;
    return rest;
  });
}
