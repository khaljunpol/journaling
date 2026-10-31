// The widget's saved state and its trip to Journal. One job at a time, because taps can arrive fast.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connFromCode, getState, postAction, type Action, type Conn, type DeviceState } from './logic/api';
import { applyLocal, enqueue, remove, sendable, type QueueItem } from './logic/queue';

const KEY = 'journal-widget';

export type Snapshot = {
  conn: Conn | null;
  state: DeviceState | null;
  picked: string[];
  keyBad: boolean;
  /** The hours tap found nothing to fill because no usual day is set. */
  noUsualHours: boolean;
  queue: QueueItem[];
};

const EMPTY: Snapshot = { conn: null, state: null, picked: [], keyBad: false, noUsualHours: false, queue: [] };

export async function snapshot(): Promise<Snapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Snapshot>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** The phone's date, YYYY-MM-DD. Only used to skip a trip; the server still decides the real day. */
function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const save = (s: Snapshot) => AsyncStorage.setItem(KEY, JSON.stringify(s));

let chain: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
}

/** Fresh day from the server, then every waiting tap in order. A 401 can pass, so the key and taps stay. */
async function flush(s: Snapshot): Promise<Snapshot> {
  if (!s.conn) return s;
  let next: Snapshot = s;
  if (!s.queue.length || s.state?.date !== localDay()) {
    const first = await getState(s.conn);
    if (first.kind === 'key') return { ...s, keyBad: true };
    if (first.kind !== 'ok') return s;
    next = { ...s, keyBad: false, state: first.state, queue: sendable(s.queue, first.state.date) };
  }

  for (const item of next.queue) {
    const r = await postAction(s.conn, item.action);
    if (r.kind === 'retry') break;
    if (r.kind === 'key') return { ...next, keyBad: true };
    next = { ...next, keyBad: false, queue: remove(next.queue, item.id) };
    if (r.kind === 'ok') {
      next = { ...next, state: r.state };
      if (item.action.action === 'hours') next = { ...next, noUsualHours: r.reason === 'no_template' };
    }
    if (r.kind === 'gone' && item.action.action === 'habit') {
      const gone = item.action.activityId;
      next = { ...next, picked: next.picked.filter((id) => id !== gone) };
      const again = await getState(s.conn);
      if (again.kind === 'ok') next = { ...next, state: again.state };
    }
  }
  // Taps still waiting stay visible.
  if (next.state) next = { ...next, state: next.queue.reduce((st, q) => applyLocal(st, q.action), next.state) };
  return next;
}

/** Draws a tap at once: the caller repaints after this, before refresh() reaches the server. */
export function record(action: Action): Promise<Snapshot> {
  return oneAtATime(async () => {
    const s = await snapshot();
    if (!s.state) return s;
    const item: QueueItem = { id: `${Date.now()}-${Math.random()}`, action, date: s.state.date };
    const next = { ...s, state: applyLocal(s.state, action), queue: enqueue(s.queue, item) };
    await save(next);
    return next;
  });
}

export function refresh(): Promise<Snapshot> {
  return oneAtATime(async () => {
    const next = await flush(await snapshot());
    await save(next);
    return next;
  });
}

/** Stores the connection when the code is good and Journal accepts it. */
export function connect(code: string): Promise<'ok' | 'bad-code' | 'refused' | 'offline'> {
  return oneAtATime(async () => {
    const conn = connFromCode(code);
    if (!conn) return 'bad-code';
    const r = await getState(conn);
    if (r.kind === 'key') return 'refused';
    if (r.kind !== 'ok') return 'offline';
    const s = await snapshot();
    await save({ ...s, conn, state: r.state, keyBad: false, queue: [] });
    return 'ok';
  });
}

export function setPicked(picked: string[]): Promise<void> {
  return oneAtATime(async () => {
    await save({ ...(await snapshot()), picked });
  });
}
