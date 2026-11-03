"use client";

import { getCache, setCache } from '@/lib/cache';
import { MOODS, moodColor } from '@journaling/core/mood';
import type { MoodItem } from '@journaling/core/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Trends > Mood: month averages and the spread. The day-by-day calendar lives on the Insights tab. */
export default function MoodYearGrid() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [items, setItems] = useState<MoodItem[] | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function load() {
      let appliedCache = false;
      try {
        if (ctrlRef.current) ctrlRef.current.abort();
        ctrlRef.current = new AbortController();
        const cacheKey = `moods:year:${year}`;
        const normalize = (data: MoodItem[]) =>
          (Array.isArray(data) ? data : [])
            .filter((x) => typeof x?.score === 'number' && x?.date)
            .map((x) => ({ date: x.date.slice(0, 10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
        const cached = getCache<MoodItem[]>(cacheKey);
        if (cached) { setItems(normalize(cached.data)); appliedCache = true; }
        const res = await fetch(`/api/moods?from=${year}-01-01&to=${year}-12-31`, { signal: ctrlRef.current.signal });
        const data: MoodItem[] = res.ok ? await res.json() : [];
        setItems(normalize(data));
        try { setCache(cacheKey, data); } catch { /* cache is optional */ }
      } catch {
        if (!appliedCache) setItems([]);
      }
    }
    if (year) load();
  }, [year]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const avg = list.length ? list.reduce((s, it) => s + it.score, 0) / list.length : 5;
    const months = Array.from({ length: 12 }, (_, m) => {
      const inMonth = list.filter((it) => Number(it.date.slice(5, 7)) - 1 === m);
      return { m, n: inMonth.length, avg: inMonth.length ? inMonth.reduce((s, it) => s + it.score, 0) / inMonth.length : null };
    });
    const spread = MOODS.map((d) => ({ ...d, n: list.filter((it) => it.score === d.score).length }));
    const top = spread.reduce((a, b) => (b.n > a.n ? b : a), spread[0]);
    return { avg, months, spread, top, count: list.length };
  }, [items]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = now.getFullYear() - 4; y <= now.getFullYear(); y++) ys.push(y);
    return ys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardHeader
          title={`Mood in ${year}`}
          meta={items && <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>avg {stats.avg.toFixed(1)} · {stats.count} days</span>}
          actions={
            <Select aria-label="Year" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          }
        />
        {items === null ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <ol className="grid grid-cols-12 gap-1" aria-label="Average mood per month">
              {stats.months.map((mo) => (
                <li key={mo.m} className="flex flex-col items-center gap-1" aria-label={`${MONTH_INITIALS[mo.m]}: ${mo.avg === null ? 'no data' : mo.avg.toFixed(1)}`}>
                  <span className="num text-[11px]" style={{ color: 'var(--text-2)' }}>{mo.avg === null ? '–' : mo.avg.toFixed(1)}</span>
                  <span className="relative block h-16 w-full overflow-hidden rounded-[6px]" style={{ background: 'var(--surface-3)' }}>
                    {mo.avg !== null && (
                      <span className="absolute inset-x-0 bottom-0 block rounded-[6px]" style={{ height: `${(mo.avg / 10) * 100}%`, background: moodColor(mo.avg) }} />
                    )}
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{MONTH_INITIALS[mo.m]}</span>
                </li>
              ))}
            </ol>
            {stats.count > 0 && (
              <div className="mt-3">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }} role="img" aria-label={`Mood spread. Most common: ${stats.top.label}, ${stats.top.n} days`}>
                  {stats.spread.filter((s) => s.n > 0).map((s) => (
                    <span key={s.score} style={{ width: `${(s.n / stats.count) * 100}%`, background: s.color }} />
                  ))}
                </div>
                <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  Spread: most days were {stats.top.emoji} {stats.top.label.toLowerCase()} ({stats.top.n}).
                </p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
