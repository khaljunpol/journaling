'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearCacheByPrefix, getCache, setCache } from '@/lib/cache';
import type { ClimbGoal, ClimbLog } from '@/lib/types';

const GOALS_KEY = 'climb:goals';
const ALL_KEY = 'climb:year:all';
// Every climb, in one fetch, cached 5 minutes; years, streaks and bests are derived from it.
const ALL_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Goals and every climb for the Climbing page. Cached first, then fresh.
 * `onGoals` runs with each fresh goals list (before state updates), `onError` when a read fails.
 */
export function useClimbingData({ onGoals, onError }: { onGoals?: (goals: ClimbGoal[]) => void; onError?: () => void } = {}) {
  const [goals, setGoals] = useState<ClimbGoal[]>([]);
  const [allLogs, setAllLogs] = useState<ClimbLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);
  // Latest callbacks without re-running the load.
  const cb = useRef({ onGoals, onError });
  useEffect(() => { cb.current = { onGoals, onError }; });

  const load = useCallback(async () => {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();
      const cachedGoals = getCache<ClimbGoal[]>(GOALS_KEY);
      if (cachedGoals) setGoals(Array.isArray(cachedGoals.data) ? cachedGoals.data : []);
      const goalsResp = await fetch('/api/climbing/goals', { signal: ctrlRef.current.signal });
      if (!goalsResp.ok) throw new Error('goals failed');
      const gs: ClimbGoal[] = await goalsResp.json();
      const goalsArr = Array.isArray(gs) ? gs : [];
      cb.current.onGoals?.(goalsArr);
      setGoals(goalsArr);
      try { setCache(GOALS_KEY, goalsArr); } catch { /* cache is optional */ }

      const cachedAll = getCache<ClimbLog[]>(ALL_KEY);
      let fresh = false;
      if (cachedAll) { try { fresh = (Date.now() - Date.parse(cachedAll.cachedAt)) < ALL_CACHE_TTL_MS; } catch { fresh = false; } }
      if (fresh && cachedAll) {
        setAllLogs(Array.isArray(cachedAll.data) ? cachedAll.data : []);
      } else {
        const resp = await fetch('/api/climbing/logs');
        if (!resp.ok) throw new Error('logs failed');
        const items: ClimbLog[] = await resp.json();
        const arr = Array.isArray(items) ? items : [];
        setAllLogs(arr);
        try { setCache(ALL_KEY, arr); } catch { /* cache is optional */ }
      }
      setLoaded(true);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) cb.current.onError?.();
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** After a goal is saved or deleted: drop cached goals and year logs so counts are fresh, then reload. */
  const reloadFresh = useCallback(() => {
    clearCacheByPrefix('climb:year:');
    try { localStorage.removeItem(GOALS_KEY); } catch { /* storage unavailable */ }
    void load();
  }, [load]);

  return { goals, allLogs, loaded, reloadFresh };
}
