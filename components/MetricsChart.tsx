"use client";

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type Week = { week: string; rate: number; done: number; total: number; movingAvg4?: number };
type Summary = { avgRate: number; bestWeek: { week: string; rate: number } | null; currentStreakDays: number; totalCompletions: number };
type ActivitySeries = { id: string; name: string; weeks: Array<{ week: string; rate: number; done: number; total: number }> };

export default function MetricsChart() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [summary, setSummary] = useState<Summary>({ avgRate: 0, bestWeek: null, currentStreakDays: 0, totalCompletions: 0 });
  const [series, setSeries] = useState<ActivitySeries[]>([]);
  const [range, setRange] = useState<number>(12); // weeks
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [account, setAccount] = useState<string>('Alex');

  useEffect(() => {
    const init = typeof window !== 'undefined' ? localStorage.getItem('account') : null;
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/metrics?account=${encodeURIComponent(account)}`);
      if (!res.ok) return;
      const json = await res.json();
      setWeeks(Array.isArray(json?.weeks) ? json.weeks : []);
      setSeries(Array.isArray(json?.byActivity) ? json.byActivity : []);
      if (json?.summary) setSummary(json.summary);
    }
    load();
  }, [account]);

  const data = useMemo(() => {
    const n = Math.max(1, range);
    const base = weeks.slice(Math.max(0, weeks.length - n));
    const map: Record<string, any> = {};
    for (const w of base) map[w.week] = { ...w };
    for (const s of series) {
      for (const w of s.weeks) {
        if (map[w.week]) {
          map[w.week][`series_${s.id}`] = w.rate;
        }
      }
    }
    return Object.values(map);
  }, [weeks, range]);

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  const selectedSeries = useMemo(() => series.filter((s) => selectedIds.includes(s.id)), [series, selectedIds]);

  function toggleSeries(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Consistency Metrics</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 space-y-1">
          <div className="subtle text-xs uppercase tracking-wider">Avg Rate</div>
          <div className="text-2xl font-semibold">{Math.round(summary.avgRate * 100)}%</div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="subtle text-xs uppercase tracking-wider">Best Week</div>
          <div className="text-2xl font-semibold">{summary.bestWeek ? `${Math.round(summary.bestWeek.rate * 100)}%` : '—'}</div>
          <div className="subtle text-xs">{summary.bestWeek?.week || ''}</div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="subtle text-xs uppercase tracking-wider">Streak</div>
          <div className="text-2xl font-semibold">{summary.currentStreakDays}<span className="text-base font-normal subtle"> d</span></div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="subtle text-xs uppercase tracking-wider">Completions</div>
          <div className="text-2xl font-semibold">{summary.totalCompletions}</div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Weekly Consistency</div>
          <select className="input py-1 text-sm" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={12}>Last 12 weeks</option>
            <option value={26}>Last 26 weeks</option>
            <option value={52}>Last 52 weeks</option>
            <option value={weeks.length}>All</option>
          </select>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis yAxisId="rate" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={({ payload, label }) => {
                const p = payload?.[0]?.payload as Week | undefined;
                if (!p) return null;
                return (
                  <div className="card rounded-lg p-2 text-sm shadow-lg" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-medium">{label}</div>
                    <div className="subtle">Rate: {Math.round(p.rate * 100)}%</div>
                    <div className="subtle">Done: {p.done} / {p.total}</div>
                  </div>
                );
              }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="count" dataKey="done" name="Completions" fill="var(--accent)" opacity={0.7} />
              <Line yAxisId="rate" type="monotone" dataKey="rate" name="Rate" stroke="var(--accent)" dot={false} strokeWidth={2} />
              <Line yAxisId="rate" type="monotone" dataKey="movingAvg4" name="4-week MA" stroke="#16a34a" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              {selectedSeries.map((s, i) => (
                <Line key={s.id} yAxisId="rate" type="monotone" dataKey={`series_${s.id}`} name={s.name} stroke={colors[i % colors.length]} dot={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {series.length > 0 && (
          <div>
            <div className="subtle text-xs uppercase tracking-wider mb-2">Per-activity overlay</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {series.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSeries(s.id)} />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── PER-ACTIVITY SPARKLINES ──────────────────────────────────── */}
      {series.length > 0 && (
        <div className="space-y-3">
          <div className="subtle text-xs uppercase tracking-wider font-medium">Per-Activity (last 12 weeks)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {series.map((s, i) => {
              const recent = s.weeks.slice(-12);
              const avg = recent.length ? recent.reduce((a, w) => a + w.rate, 0) / recent.length : 0;
              const color = colors[i % colors.length];
              return (
                <div key={s.id} className="card p-3 space-y-2">
                  <div className="text-xs font-medium truncate" title={s.name}>{s.name}</div>
                  <div className="text-xl font-bold" style={{ color }}>{Math.round(avg * 100)}%</div>
                  <div className="h-10 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={recent} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                        <Line type="monotone" dataKey="rate" stroke={color} dot={false} strokeWidth={1.5} />
                        <Tooltip
                          content={({ payload }) => {
                            if (!payload?.length) return null;
                            const p = payload[0]?.payload as { week: string; rate: number };
                            return (
                              <div className="card rounded px-2 py-1 text-xs shadow" style={{ borderColor: 'var(--border)' }}>
                                {p.week}: {Math.round(p.rate * 100)}%
                              </div>
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
