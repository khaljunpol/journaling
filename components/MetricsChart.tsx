"use client";

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

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
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Avg Rate</div>
          <div className="text-2xl font-semibold">{Math.round(summary.avgRate * 100)}%</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Best Week</div>
          <div className="text-2xl font-semibold">{summary.bestWeek ? `${Math.round(summary.bestWeek.rate * 100)}%` : '-'}</div>
          <div className="text-xs text-neutral-500">{summary.bestWeek?.week || ''}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Current Streak</div>
          <div className="text-2xl font-semibold">{summary.currentStreakDays} days</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Total Completions</div>
          <div className="text-2xl font-semibold">{summary.totalCompletions}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Weekly Consistency</h2>
        <select className="rounded border px-2 py-1" value={range} onChange={(e) => setRange(Number(e.target.value))}>
          <option value={12}>Last 12 weeks</option>
          <option value={26}>Last 26 weeks</option>
          <option value={52}>Last 52 weeks</option>
          <option value={weeks.length}>All</option>
        </select>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis yAxisId="rate" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <YAxis yAxisId="count" orientation="right" allowDecimals={false} />
            <Tooltip content={({ payload, label }) => {
              const p = payload?.[0]?.payload as Week | undefined;
              if (!p) return null;
              return (
                <div className="rounded border bg-white p-2 text-sm shadow dark:bg-neutral-900">
                  <div className="font-medium">{label}</div>
                  <div>Rate: {Math.round(p.rate * 100)}%</div>
                  <div>Done: {p.done} / {p.total}</div>
                </div>
              );
            }} />
            <Legend />
            <Bar yAxisId="count" dataKey="done" name="Completions" fill="#c084fc" />
            <Line yAxisId="rate" type="monotone" dataKey="rate" name="Rate" stroke="#2563eb" dot={false} />
            <Line yAxisId="rate" type="monotone" dataKey="movingAvg4" name="4-week MA" stroke="#16a34a" dot={false} />
            {selectedSeries.map((s, i) => (
              <Line key={s.id} yAxisId="rate" type="monotone" dataKey={`series_${s.id}`} name={s.name} stroke={colors[i % colors.length]} dot={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {series.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSeries(s.id)} />
            <span>{s.name}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
