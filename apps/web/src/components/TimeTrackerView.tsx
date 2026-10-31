"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import Donut from '@/components/overview/Donut';
import { timeBalance } from '@journaling/core/timeBalance';
import { Card, CardHeader } from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { getCache, setCache } from '@/lib/cache';
import { AXIS_TICK, CHART_SERIES, TOOLTIP_STYLE } from '@/lib/chartTheme';
import { localISO, localTodayISO, pad } from '@journaling/core/date';
import { timeSplit } from '@journaling/core/overview';
import type { TimeCategory, TimeEntry } from '@journaling/core/types';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-40';

/** Time charts for Trends: last 7 days, weekly balance and the category split. The day editor lives on Today. */
export default function TimeTrackerView() {
  const [yearLogs, setYearLogs] = useState<TimeEntry[] | null>(() => getCache<TimeEntry[]>(`time:year:${new Date().getFullYear()}`)?.data ?? null);
  const [cats, setCats] = useState<TimeCategory[]>(() => getCache<TimeCategory[]>('time:cats')?.data ?? []);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth());

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const yRes = await fetch(`/api/time?from=${viewYear}-01-01&to=${viewYear}-12-31`, { signal: ctrl.signal });
        const yItems: TimeEntry[] = yRes.ok ? await yRes.json() : [];
        if (!ctrl.signal.aborted) {
          setYearLogs(Array.isArray(yItems) ? yItems : []);
          try { setCache(`time:year:${viewYear}`, Array.isArray(yItems) ? yItems : []); } catch { /* cache is optional */ }
        }
        const cRes = await fetch('/api/time/categories', { signal: ctrl.signal });
        const list: TimeCategory[] = cRes.ok ? await cRes.json() : [];
        if (!ctrl.signal.aborted) {
          setCats(Array.isArray(list) ? list : []);
          try { setCache('time:cats', Array.isArray(list) ? list : []); } catch { /* cache is optional */ }
        }
      } catch {
        if (!ctrl.signal.aborted) setYearLogs((prev) => prev ?? []);
      }
    })();
    return () => ctrl.abort();
  }, [viewYear]);

  const catsSorted = useMemo(() => [...cats].sort((a, b) => a.order - b.order), [cats]);
  const logs = useMemo(() => yearLogs ?? [], [yearLogs]);

  // Last 7 days, stacked by category.
  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = localISO(d);
      const row: Record<string, number | string> = { iso, label: d.toLocaleDateString(undefined, { weekday: 'short' }), total: 0 };
      for (const l of logs) {
        if (l.date !== iso) continue;
        const k = `c${l.category}`;
        row[k] = ((row[k] as number) || 0) + 1;
        row.total = (row.total as number) + 1;
      }
      return row;
    });
  }, [logs]);
  const weekTotal = week.reduce((a, d) => a + (d.total as number), 0);

  const balance = useMemo(() => {
    const from = week[0].iso as string;
    return timeBalance(logs.filter((l) => l.date >= from && l.date <= localTodayISO()), cats);
  }, [logs, cats, week]);
  const balanceTotal = balance.productive + balance.rest + balance.sleep;

  const range = useMemo(() => {
    if (viewMode === 'year') return { from: `${viewYear}-01-01`, to: `${viewYear}-12-31` };
    const last = new Date(viewYear, viewMonth + 1, 0).getDate();
    return { from: `${viewYear}-${pad(viewMonth + 1)}-01`, to: `${viewYear}-${pad(viewMonth + 1)}-${pad(last)}` };
  }, [viewMode, viewYear, viewMonth]);
  const split = useMemo(() => timeSplit(logs, cats, range.from, range.to, 6), [logs, cats, range]);

  function step(dir: 1 | -1) {
    if (viewMode === 'year') { setViewYear((v) => v + dir); return; }
    const m = viewMonth + dir;
    if (m < 0) { setViewYear((v) => v - 1); setViewMonth(11); }
    else if (m > 11) { setViewYear((v) => v + 1); setViewMonth(0); }
    else setViewMonth(m);
  }
  const periodLabel = viewMode === 'month' ? `${MONTH_NAMES[viewMonth]} ${viewYear}` : String(viewYear);
  const loading = yearLogs === null;

  const balanceParts = [
    { label: 'Productive', hours: balance.productive, color: CHART_SERIES[0] },
    { label: 'Rest', hours: balance.rest, color: CHART_SERIES[1] },
    { label: 'Sleep', hours: balance.sleep, color: CHART_SERIES[2] },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardHeader title="Last 7 days" meta={<span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{weekTotal}h logged</span>} />
        {loading ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <div className="h-36 w-full" role="img" aria-label={`Stacked bars of hours per category for the last 7 days, ${weekTotal} hours in total`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    const row = payload[0].payload as Record<string, number | string>;
                    return (
                      <div className="rounded-[10px] border px-3 py-2 text-[13px]" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)', color: 'var(--text-1)' }}>
                        <div className="num font-medium">{label} · {row.total as number}h</div>
                        {catsSorted.filter((c) => row[`c${c.id}`]).map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span aria-hidden="true" className="h-2 w-2 rounded-[2px]" style={{ background: c.color }} />
                            <span style={{ color: 'var(--text-2)' }}>{c.name}</span>
                            <span className="num ml-auto">{row[`c${c.id}`] as number}h</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {catsSorted.map((c) => (
                  <Bar key={c.id} dataKey={`c${c.id}`} stackId="t" fill={c.color} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Weekly balance" meta={<span className="text-[13px]" style={{ color: 'var(--text-2)' }}>Productive, rest, sleep</span>} />
        {loading ? (
          <Skeleton className="h-14 w-full" />
        ) : balanceTotal === 0 ? (
          <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No hours in these groups this week.</p>
        ) : (
          <>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--surface-3)' }}
              role="img"
              aria-label={balanceParts.map((p) => `${p.label} ${p.hours} hours`).join(', ')}
            >
              {balanceParts.map((p) => (
                <div key={p.label} style={{ width: `${(p.hours / balanceTotal) * 100}%`, background: p.color }} />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {balanceParts.map((p) => (
                <li key={p.label} className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: p.color }} />
                    <span className="truncate">{p.label}</span>
                  </div>
                  <div className="num text-[20px]" style={{ color: 'var(--text-1)' }}>
                    {p.hours}h <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{Math.round((p.hours / balanceTotal) * 100)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Time split"
          actions={
            <div className="flex rounded-full p-0.5" role="group" aria-label="Period" style={{ background: 'var(--surface-2)' }}>
              {(['month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  className="min-h-11 rounded-full px-4 text-[13px] font-medium capitalize"
                  style={viewMode === mode ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { color: 'var(--text-2)' }}
                >
                  {mode}
                </button>
              ))}
            </div>
          }
        />
        <div className="mb-3 flex items-center justify-center gap-2">
          <button type="button" aria-label="Previous period" onClick={() => step(-1)} className={iconBtn} style={{ color: 'var(--text-1)' }}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="num min-w-36 text-center text-[14px] font-medium" style={{ color: 'var(--text-2)' }}>{periodLabel}</span>
          <button type="button" aria-label="Next period" onClick={() => step(1)} className={iconBtn} style={{ color: 'var(--text-1)' }}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        {loading || cats.length === 0 ? (
          <Skeleton className="h-28 w-full" />
        ) : split.total === 0 ? (
          <p className="py-6 text-center text-[14px]" style={{ color: 'var(--text-2)' }}>No hours logged for this {viewMode}.</p>
        ) : (
          <Donut slices={split.slices} total={split.total} />
        )}
      </Card>
    </div>
  );
}
