'use client';

import { useEffect, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import { localTodayISO } from '@journaling/core/date';
import type { Insights } from '@journaling/core/insights';

/** GET /api/insights, drawn from `insights:{today}` first, then swapped quietly. Read-only. */
export function useInsights(): { data: Insights | null; failed: boolean } {
  const [today] = useState(() => localTodayISO());
  const key = `insights:${today}`;
  const [data, setData] = useState<Insights | null>(() => getCache<Insights>(key)?.data ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/insights', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('read failed'))))
      .then((d: Insights) => {
        if (!d || !Array.isArray(d.lifts)) throw new Error('bad shape');
        setData(d);
        setFailed(false);
        try { setCache(key, d); } catch { /* cache is optional */ }
      })
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, [key]);

  return { data, failed };
}
