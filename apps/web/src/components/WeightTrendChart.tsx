'use client';

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getCache, setCache } from '@/lib/cache';
import { localISO, localTodayISO, parseLocalDate } from '@journaling/core/date';
import type { WeightPoint } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

const CACHE_KEY = 'weights:8w';

function r1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Weight over the last 8 weeks with a 5-point average. Moved here from the old Dashboard. */
export default function WeightTrendChart() {
  const [points, setPoints] = useState<WeightPoint[] | null>(() => getCache<WeightPoint[]>(CACHE_KEY)?.data ?? null);

  useEffect(() => {
    const ctrl = new AbortController();
    const to = localTodayISO();
    const d = parseLocalDate(to);
    d.setDate(d.getDate() - 7 * 8);
    const from = localISO(d);
    void (async () => {
      try {
        const res = await fetch(`/api/weights?from=${from}&to=${to}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as WeightPoint[];
        if (!Array.isArray(data) || ctrl.signal.aborted) return;
        setPoints(data);
        setCache(CACHE_KEY, data);
      } catch { /* keep the cached copy */ }
    })();
    return () => ctrl.abort();
  }, []);

  const data = useMemo(
    () =>
      (points ?? []).map((p, i, all) => {
        const slice = all.slice(Math.max(0, i - 4), i + 1);
        return { date: p.date, weight: p.weight, avg: r1(slice.reduce((a, x) => a + x.weight, 0) / slice.length) };
      }),
    [points],
  );

  const change = useMemo(() => {
    const w = points ?? [];
    if (w.length < 5) return null;
    const last4 = w.slice(-4).map((p) => p.weight);
    const prev4 = w.slice(-8, -4).map((p) => p.weight);
    if (prev4.length === 0) return null;
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    return { now: r1(mean(last4)), delta: r1(mean(last4) - mean(prev4)) };
  }, [points]);

  return (
    <Card>
      <CardHeader
        title="Weight, 8 weeks"
        meta={
          change && (
            <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>
              {change.now} kg, {change.delta > 0 ? '+' : change.delta < 0 ? '−' : ''}
              {Math.abs(change.delta)} kg vs the 4 weeks before
            </span>
          )
        }
      />
      {points === null ? (
        <Skeleton className="h-52 w-full" />
      ) : data.length === 0 ? (
        <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No weights logged yet.</p>
      ) : (
        <div className="h-52 w-full" role="img" aria-label="Line chart of weight over the last 8 weeks">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-3)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(d: string) => parseLocalDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 12 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={44} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 13, color: 'var(--text-1)' }}
                labelStyle={{ color: 'var(--text-2)' }}
                formatter={(v, name) => [`${v} kg`, name === 'avg' ? '5-point average' : 'Weight']}
              />
              <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="avg" stroke="var(--text-3)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
