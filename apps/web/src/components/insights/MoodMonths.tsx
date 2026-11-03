'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import Skeleton from '@/components/ui/Skeleton';
import { MOODS, moodColor } from '@journaling/core/mood';
import type { MoodItem } from '@journaling/core/types';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Mood by month and the mood spread for one year. Shown under the calendar when its Mood layer is on. */
export default function MoodMonths({ year }: { year: number }) {
  const [items, setItems] = useState<MoodItem[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const key = `moods:year:${year}`;
    const clean = (data: MoodItem[]) => (Array.isArray(data) ? data : [])
      .filter((x) => typeof x?.score === 'number' && x?.date)
      .map((x) => ({ date: x.date.slice(0, 10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
    const cached = getCache<MoodItem[]>(key)?.data;
    setItems(cached ? clean(cached) : null);
    fetch(`/api/moods?from=${year}-01-01&to=${year}-12-31`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MoodItem[]) => {
        setItems(clean(data));
        try { setCache(key, data); } catch { /* cache is optional */ }
      })
      .catch(() => { if (!ctrl.signal.aborted) setItems((cur) => cur ?? []); });
    return () => ctrl.abort();
  }, [year]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const months = Array.from({ length: 12 }, (_, m) => {
      const inMonth = list.filter((it) => Number(it.date.slice(5, 7)) - 1 === m);
      return { m, avg: inMonth.length ? inMonth.reduce((s, it) => s + it.score, 0) / inMonth.length : null };
    });
    const spread = MOODS.map((d) => ({ ...d, n: list.filter((it) => it.score === d.score).length }));
    const top = spread.reduce((a, b) => (b.n > a.n ? b : a), spread[0]);
    return { months, spread, top, count: list.length };
  }, [items]);

  if (items === null) return <Skeleton className="mt-4 h-24 w-full" />;
  if (!stats.count) return null;
  return (
    <div className="mt-4">
      <ol className="grid grid-cols-12 gap-1" aria-label="Average mood per month">
        {stats.months.map((mo) => (
          <li key={mo.m} className="flex flex-col items-center gap-1" aria-label={`${MONTH_INITIALS[mo.m]}: ${mo.avg === null ? 'no data' : mo.avg.toFixed(1)}`}>
            <span className="num text-[11px]" style={{ color: 'var(--text-2)' }}>{mo.avg === null ? '–' : mo.avg.toFixed(1)}</span>
            <span className="relative block h-12 w-full overflow-hidden rounded-[6px]" style={{ background: 'var(--surface-3)' }}>
              {mo.avg !== null && <span className="absolute inset-x-0 bottom-0 block rounded-[6px]" style={{ height: `${(mo.avg / 10) * 100}%`, background: moodColor(mo.avg) }} />}
            </span>
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{MONTH_INITIALS[mo.m]}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }} role="img" aria-label={`Mood spread. Most common: ${stats.top.label}, ${stats.top.n} days`}>
        {stats.spread.filter((s) => s.n > 0).map((s) => <span key={s.score} style={{ width: `${(s.n / stats.count) * 100}%`, background: s.color }} />)}
      </div>
      <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>Most days were {stats.top.emoji} {stats.top.label.toLowerCase()} ({stats.top.n}).</p>
    </div>
  );
}
