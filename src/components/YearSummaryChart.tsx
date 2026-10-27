"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, CHART_SERIES, TOOLTIP_STYLE } from '@/lib/chartTheme';
import { parseLocalDate } from '@/lib/date';

/** Weekly sends for a year. Accent = at or above the weekly average. Tap or hover a bar for its value. */
export default function YearSummaryChart({ series, weeklyAvg, goalsYear }: { series: Array<{ date: string; count: number }>; weeklyAvg: number; goalsYear: number }) {
  // One label per quarter keeps the axis readable at 390 px.
  const labelAt = new Map<number, string>();
  for (let i = 0; i < series.length; i++) {
    const d = parseLocalDate(series[i].date);
    if (d.getFullYear() !== goalsYear) continue;
    const prev = i > 0 ? parseLocalDate(series[i - 1].date) : null;
    if ((!prev || prev.getMonth() !== d.getMonth()) && d.getMonth() % 3 === 0) {
      labelAt.set(i, d.toLocaleString(undefined, { month: 'short' }));
    }
  }

  return (
    <div className="h-28 w-full" role="img" aria-label={`Bar chart of weekly sends in ${goalsYear}, average ${weeklyAvg} a week`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="15%">
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            interval={0}
            tickFormatter={(_v: string, i: number) => labelAt.get(i) ?? ''}
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(l) => `Week of ${l}`}
            formatter={(v) => [`${v} sends`, '']}
          />
          <ReferenceLine y={weeklyAvg} stroke="var(--text-3)" strokeDasharray="3 3" strokeWidth={1} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {series.map((entry) => (
              <Cell key={entry.date} fill={entry.count >= weeklyAvg ? CHART_SERIES[0] : 'var(--border-strong)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
