"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseLocalDate } from '@/lib/date';

export default function YearSummaryChart({ series, weeklyAvg, goalsYear }: { series: Array<{ date: string; count: number }>; weeklyAvg: number; goalsYear: number }) {
  // Build month tick positions
  const monthTicks: Array<{ index: number; label: string }> = [];
  for (let i = 0; i < series.length; i++) {
    const d = parseLocalDate(series[i].date);
    if (d.getFullYear() !== goalsYear) continue;
    const prev = i > 0 ? parseLocalDate(series[i - 1].date) : null;
    if (!prev || prev.getMonth() !== d.getMonth()) {
      monthTicks.push({ index: i, label: d.toLocaleString(undefined, { month: 'short' }) });
    }
  }

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={series}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          barCategoryGap="15%"
        >
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            interval={0}
            tickFormatter={(v: string, i: number) => {
              const match = monthTicks.find((t) => t.index === i);
              return match ? match.label : '';
            }}
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            cursor={{ fill: 'var(--surface-alt)' }}
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              return (
                <div
                  className="rounded-xl px-3 py-1.5 text-xs shadow-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <span className="font-medium">Week of {label}</span> · {payload[0]?.value} sends
                </div>
              );
            }}
          />
          <ReferenceLine y={weeklyAvg} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeWidth={1} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {series.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.count >= weeklyAvg ? '#16a34a' : 'var(--border)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
