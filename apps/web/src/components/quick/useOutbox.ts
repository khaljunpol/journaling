'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classify, discardKeys, settleUnconfirmed, enqueue as enqueueItem, mergeQueues, nextBase, nextToSend, onResult, type OutboxItem } from '@/lib/outbox';
import { loadOutbox, readOutbox, saveOutbox } from '@/lib/quickStore';

const TICK_MS = 15000;

/** Local-first writes: enqueue saves to the phone, then the outbox sends and retries. */
export function useOutbox(email: string, canSend = true) {
  const router = useRouter();
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const qRef = useRef<OutboxItem[]>([]);
  const drainRef = useRef<() => void>(() => {});
  const inflight = useRef<Set<string>>(new Set());
  const baseRef = useRef<OutboxItem[]>([]);
  const loaded = useRef(false);
  const loadedFor = useRef(''); // the email the in-memory queue belongs to
  const prevEmail = useRef('');
  const canSendRef = useRef(canSend);
  const [persistOk, setPersistOk] = useState(true);

  const commit = useCallback((next: OutboxItem[]) => {
    if (loadedFor.current !== email) return; // never write one user's queue under another key
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
    if (!loaded.current || !canSendRef.current || loadedFor.current !== email) return;
    // One request per sheet group at a time; the next one of the group goes out as soon as this one is back.
    for (const item of nextToSend(qRef.current, Date.now(), inflight.current)) {
      inflight.current.add(item.key);
      const sentBody = item.body;
      void (async () => {
        let status: number | 'network' = 'network';
        try {
          const res = await fetch(item.url, {
            method: item.method,
            // The tap time, so a save that waited offline doesn't look late.
            headers: { 'Content-Type': 'application/json', 'x-logged-at': String(item.updatedAt) },
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
        else drainRef.current();
      })();
    }
  }, [commit, router, email]);
  useEffect(() => { drainRef.current = drain; }, [drain]);

  const enqueue = useCallback((item: Omit<OutboxItem, 'attempts' | 'nextAt' | 'state' | 'updatedAt'>) => {
    const flagged = canSendRef.current ? item : { ...item, unconfirmed: true };
    commit(enqueueItem(qRef.current, flagged, Date.now()));
    drain();
  }, [commit, drain]);

  /** Forget changes that will never save (the tile's Discard). */
  const discard = useCallback((keys: string[]) => {
    commit(discardKeys(qRef.current, keys));
  }, [commit]);

  // Declared before the load effect so the flag is current when it drains. Nothing is sent until the session is confirmed.
  useEffect(() => {
    canSendRef.current = canSend;
    if (canSend && loadedFor.current === email) {
      // Same user confirmed: taps made while unconfirmed may now be sent.
      commit(settleUnconfirmed(qRef.current, true));
      drain();
    }
  }, [canSend, drain, commit, email]);

  useEffect(() => {
    const prev = prevEmail.current;
    if (canSendRef.current && prev && prev !== email) {
      // A different user is confirmed: taps made while unconfirmed belong to them, not to the old email's sheet.
      const stored = readOutbox(prev);
      if (stored) saveOutbox(prev, settleUnconfirmed(stored, false));
    }
    prevEmail.current = email;
    let loadedQ = loadOutbox(email);
    if (canSendRef.current) loadedQ = settleUnconfirmed(loadedQ, true);
    qRef.current = loadedQ;
    baseRef.current = qRef.current;
    loaded.current = true;
    loadedFor.current = email;
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
      loaded.current = false;
      loadedFor.current = '';
      qRef.current = [];
      inflight.current = new Set();
    };
  }, [email, drain]);

  return { queue, enqueue, discard, drain, persistOk };
}
