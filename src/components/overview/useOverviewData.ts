'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import { localTodayISO } from '@/lib/date';
import { lastDates } from '@/lib/overview';
import { applyQueue } from '@/lib/quickApply';
import type { QuickPayload } from '@/lib/quickPayload';
import { getLastEmail, loadOutbox, loadSnapshot } from '@/lib/quickStore';
import type { MoodItem } from '@/lib/types';
import { deriveOverview, type DashboardData } from './derive';

type HabitLog = { date: string; activityId: string; completed: boolean };

/**
 * Loads /api/dashboard and /api/quick (14 days), draws from the phone's copy first, and returns the view.
 * Reads Today's outbox so unsent taps show up here too. Never writes Today's snapshot or outbox.
 */
export function useOverviewData() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email?.toLowerCase() ?? '';
  const [lastEmail] = useState(() => getLastEmail() ?? '');
  const email = sessionEmail || lastEmail;
  const confirmed = status === 'authenticated' && sessionEmail !== '';
  const [today] = useState(() => localTodayISO());
  const year = Number(today.slice(0, 4));

  const cachedDash = useMemo(() => getCache<DashboardData>('dashboard')?.data ?? null, []);
  const cachedYear = useMemo(() => getCache<MoodItem[]>(`moods:year:${year}`)?.data ?? null, [year]);
  const cachedHistory = useMemo(() => getCache<HabitLog[]>('logs:history')?.data ?? null, []);
  const snapshot = useMemo(() => (email ? loadSnapshot(email) : null), [email]);

  const [dashFresh, setDashFresh] = useState<DashboardData | null>(null);
  const [quickFresh, setQuickFresh] = useState<QuickPayload | null>(null);
  const [historyFresh, setHistoryFresh] = useState<HabitLog[] | null>(null);
  const [yearFresh, setYearFresh] = useState<MoodItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!confirmed) return;
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const days = lastDates(today, 14);
    let dashOk = false;
    let quickOk = false;
    const settle = () => {
      if (!signal.aborted) setFailed(!dashOk && !quickOk);
    };

    void (async () => {
      try {
        const res = await fetch('/api/dashboard', { signal });
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as DashboardData;
        dashOk = true;
        if (signal.aborted) return;
        setDashFresh(data);
        setCache('dashboard', data);
      } catch { /* keep the cached copy */ }
      settle();
    })();

    void (async () => {
      try {
        const res = await fetch(`/api/quick?from=${days[0]}&to=${today}`, { signal });
        if (res.status === 401) return router.replace('/login');
        if (res.status === 403) return router.replace('/setup');
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as QuickPayload;
        quickOk = true;
        if (!signal.aborted) setQuickFresh(data);
      } catch { /* keep the phone copy */ }
      settle();
    })();

    // All habit rows since the start of last year, for the slow-decay habit score (one read-only request).
    void (async () => {
      try {
        const res = await fetch(`/api/logs?from=${year - 1}-01-01&to=${today}`, { signal });
        if (!res.ok) return;
        const data = (await res.json()) as HabitLog[];
        if (signal.aborted || !Array.isArray(data)) return;
        setHistoryFresh(data);
        setCache('logs:history', data);
      } catch { /* the 30-day rows from the dashboard are used instead */ }
    })();

    // The year heatmap only shows from 640 px up, so phones skip this request.
    if (window.matchMedia('(min-width: 640px)').matches) {
      void (async () => {
        try {
          const res = await fetch(`/api/moods?from=${year}-01-01&to=${year}-12-31`, { signal });
          if (!res.ok) return;
          const data = (await res.json()) as MoodItem[];
          if (signal.aborted || !Array.isArray(data)) return;
          setYearFresh(data);
          setCache(`moods:year:${year}`, data);
        } catch { /* heatmap stays empty */ }
      })();
    }

    return () => ctrl.abort();
  }, [confirmed, today, year, router, tick]);

  const dash = dashFresh ?? cachedDash;
  const base = quickFresh ?? snapshot;
  const queue = useMemo(() => (email ? loadOutbox(email) : []), [email]);
  const quick = useMemo(() => (base && base.days ? applyQueue(base, queue) : null), [base, queue]);
  const view = useMemo(() => deriveOverview({ today, dash, quick, queue, history: historyFresh ?? cachedHistory }), [today, dash, quick, queue, historyFresh, cachedHistory]);

  const yearMoods = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of yearFresh ?? cachedYear ?? []) out[m.date] = Number(m.score);
    return out;
  }, [yearFresh, cachedYear]);

  return {
    today,
    view,
    yearMoods,
    year,
    hasDash: dash !== null,
    hasQuick: quick !== null,
    failed: failed && dash === null && quick === null,
    retry: () => {
      setFailed(false);
      setTick((t) => t + 1);
    },
  };
}
