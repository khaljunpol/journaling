'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classify, due, enqueue as enqueueItem, mergeQueues, nextBase, onResult, type OutboxItem } from '@/lib/outbox';
import { loadOutbox, readOutbox, saveOutbox } from '@/lib/quickStore';

const TICK_MS = 15000;

/** Local-first writes: enqueue saves to the phone, then the outbox sends and retries. */
export function useOutbox(email: string) {
  const router = useRouter();
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const qRef = useRef<OutboxItem[]>([]);
  const inflight = useRef<Set<string>>(new Set());
  const baseRef = useRef<OutboxItem[]>([]);
  const loaded = useRef(false);
  const [persistOk, setPersistOk] = useState(true);

  const commit = useCallback((next: OutboxItem[]) => {
    // Another tab shares this storage key: merge with what is stored so neither tab erases the other.
    // If storage cannot be read, keep local as it is. The base only moves after a successful write.
    const stored = readOutbox(email);
    const merged = stored ? mergeQueues(stored, next, baseRef.current) : next;
    const ok = saveOutbox(email, merged);
    baseRef.current = nextBase(baseRef.current, merged, ok);
    qRef.current = merged;
    setPersistOk(ok);
    setQueue(merged);
  }, [email]);

  const drain = useCallback(() => {
    if (!loaded.current) return;
    for (const item of due(qRef.current, Date.now())) {
      if (inflight.current.has(item.key)) continue;
      inflight.current.add(item.key);
      const sentBody = item.body;
      void (async () => {
        let status: number | 'network' = 'network';
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
          });
          status = res.status;
        } catch { /* offline: stays 'network' */ }
        inflight.current.delete(item.key);
        const result = classify(status);
        const current = qRef.current.find((x) => x.key === item.key);
        // Replaced while sending: the newer body is still waiting, so keep it as it is.
        if (current && current.body === sentBody) {
          commit(onResult(qRef.current, item.key, result, Date.now()));
        }
        if (result === 'auth') router.replace(status === 403 ? '/setup' : '/login');
      })();
    }
  }, [commit, router]);

  const enqueue = useCallback((item: Omit<OutboxItem, 'attempts' | 'nextAt' | 'state' | 'updatedAt'>) => {
    commit(enqueueItem(qRef.current, item, Date.now()));
    drain();
  }, [commit, drain]);

  useEffect(() => {
    qRef.current = loadOutbox(email);
    baseRef.current = qRef.current;
    loaded.current = true;
    setQueue(qRef.current);
    drain();
    const onVisible = () => { if (document.visibilityState === 'visible') drain(); };
    const onStorage = () => {
      const stored = readOutbox(email);
      if (!stored) return;
      const merged = mergeQueues(stored, qRef.current, baseRef.current);
      baseRef.current = stored; // what storage holds, so unsaved local items are not mistaken for finished ones
      qRef.current = merged;
      setQueue(merged);
      drain();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', drain);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(drain, TICK_MS);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', drain);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [email, drain]);

  return { queue, enqueue, drain, persistOk };
}
