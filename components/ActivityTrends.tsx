"use client";

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';
import { useAccount } from '@/lib/useAccount';
import type { ActivitySeries } from '@/lib/types';

const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function ActivityTrends() {
  const [series, setSeries] = useState<ActivitySeries[]>([]);
  const [loading, setLoading] = useState(true);
  const account = useAccount();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics?account=${encodeURIComponent(account)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        setSeries(Array.isArray(json?.byActivity) ? json.byActivity : []);
      })
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, [account]);

  if (loading) return <div className="card p-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading trends…</div>;
  if (series.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
        <span className="font-medium text-sm">Activity Trends</span>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Last 12 weeks</span>
      </div>
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
  );
}
