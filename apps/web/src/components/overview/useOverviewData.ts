'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { clearCacheByPrefix, getCache, setCache } from '@/lib/cache';
import { localTodayISO } from '@journaling/core/date';
import { lastDates } from '@journaling/core/overview';
import { monthAgo, type HabitLog, type HourRow } from '@journaling/core/overviewStats';
import { applyQueue } from '@journaling/core/quickApply';
import type { QuickPayload } from '@journaling/core/quickPayload';
import { addDaysISO } from '@journaling/core/quickWeek';
import { getLastEmail, loadOutbox, loadSnapshot } from '@/lib/quickStore';
import type { MoodItem } from '@/lib/types';
import { deriveOverview, type DashboardData } from './derive';

/** GET a JSON array (or object) and keep it; any failure keeps the cached copy. */
async function getJson<T>(url: string, signal: AbortSignal, isArray = true): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    if (signal.aborted || (isArray && !Array.isArray(data))) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Loads /api/dashboard and /api/quick (14 days), plus read-only extras: 90 days of moods, the day a month ago,
 * habit history and (only in early January) last year's hour tail. Draws from the phone's copy first.
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
  const from90 = addDaysISO(today, -89);
  const ago = monthAgo(today);
  // The 90-day window reaches into last year only in early January; then hours from last year are read too.
  const needsTail = from90 < `${year}-01-01`;

  const cachedDash = useMemo(() => getCache<DashboardData>('dashboard')?.data ?? null, []);
  const cachedHistory = useMemo(() => getCache<HabitLog[]>('logs:history')?.data ?? null, []);
  const cachedMoods = useMemo(() => getCache<MoodItem[]>('moods:90d')?.data ?? null, []);
  const cachedRemember = useMemo(() => getCache<QuickPayload>(`remember:${ago}`)?.data ?? null, [ago]);
  const cachedTail = useMemo(() => (needsTail ? getCache<HourRow[]>(`hours:tail:${year}`)?.data ?? null : null), [needsTail, year]);
  const snapshot = useMemo(() => (email ? loadSnapshot(email) : null), [email]);

  const [dashFresh, setDashFresh] = useState<DashboardData | null>(null);
  const [quickFresh, setQuickFresh] = useState<QuickPayload | null>(null);
  const [historyFresh, setHistoryFresh] = useState<HabitLog[] | null>(null);
  const [moodsFresh, setMoodsFresh] = useState<MoodItem[] | null>(null);
  const [rememberFresh, setRememberFresh] = useState<QuickPayload | null>(null);
  const [rememberFailed, setRememberFailed] = useState(false);
  const [dashFailed, setDashFailed] = useState(false);
  const [tailFresh, setTailFresh] = useState<HourRow[] | null>(null);
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
      const data = await getJson<DashboardData>('/api/dashboard', signal, false);
      if (data) {
        dashOk = true;
        setDashFresh(data);
        setCache('dashboard', data);
      } else if (!signal.aborted) setDashFailed(true);
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

    // All habit rows since the start of last year: streaks and the best streak this year.
    void (async () => {
      const data = await getJson<HabitLog[]>(`/api/logs?from=${year - 1}-01-01&to=${today}`, signal);
      if (!data) return; // the 30-day rows from the dashboard are used instead
      setHistoryFresh(data);
      setCache('logs:history', data);
    })();

    // 90 days of moods: the week numbers and the mood links.
    void (async () => {
      const data = await getJson<MoodItem[]>(`/api/moods?from=${from90}&to=${today}`, signal);
      if (!data) return;
      setMoodsFresh(data);
      setCache('moods:90d', data);
    })();

    // The same day a month ago, for Remember.
    void (async () => {
      const data = await getJson<QuickPayload>(`/api/quick?from=${ago}&to=${ago}`, signal, false);
      if (signal.aborted) return;
      if (!data || !data.days) {
        setRememberFailed(true); // with no cache the half says "Couldn't load", never "Nothing logged"
        return;
      }
      setRememberFresh(data);
      clearCacheByPrefix('remember:'); // one key only: older month-ago days are never read again
      setCache(`remember:${ago}`, data);
    })();

    if (needsTail) {
      void (async () => {
        const data = await getJson<HourRow[]>(`/api/time?from=${from90}&to=${year - 1}-12-31`, signal);
        if (!data) return;
        setTailFresh(data);
        setCache(`hours:tail:${year}`, data);
      })();
    }

    return () => ctrl.abort();
  }, [confirmed, today, year, from90, ago, needsTail, router, tick]);

  const dash = dashFresh ?? cachedDash;
  const base = quickFresh ?? snapshot;
  const queue = useMemo(() => (email ? loadOutbox(email) : []), [email]);
  const quick = useMemo(() => (base && base.days ? applyQueue(base, queue) : null), [base, queue]);
  const rememberBase = rememberFresh ?? cachedRemember;
  const remember = useMemo(() => (rememberBase && rememberBase.days ? applyQueue(rememberBase, queue) : null), [rememberBase, queue]);
  const history = historyFresh ?? cachedHistory;
  const moods90 = moodsFresh ?? cachedMoods;
  const hoursTail = needsTail ? tailFresh ?? cachedTail : null;
  const view = useMemo(
    () => deriveOverview({ today, dash, quick, history, moods90, hoursTail, remember, rememberFailed }),
    [today, dash, quick, history, moods90, hoursTail, remember, rememberFailed],
  );

  return {
    today,
    view,
    hasDash: dash !== null,
    /** the dashboard read failed and there is no cached copy: dashboard-only sections show a quiet line */
    dashFailed: dashFailed && dash === null,
    failed: failed && dash === null && quick === null,
    retry: () => {
      setFailed(false);
      setDashFailed(false);
      setRememberFailed(false);
      setTick((t) => t + 1);
    },
  };
}
