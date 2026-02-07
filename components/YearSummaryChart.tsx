"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function pad(n: number) { return String(n).padStart(2, '0'); }
function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export default function YearSummaryChart({ series, weeklyAvg, goalsYear }: { series: Array<{ date: string; count: number }>; weeklyAvg: number; goalsYear: number }) {
  return (
    <div className="mt-2 h-16 relative -left-4 w-[calc(100%+2rem)] overflow-visible">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={series}
          margin={{ top: 0, right: 15, left: -30, bottom: 12 }}
          barCategoryGap="-30%"
          barGap={0}
        >
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            padding={{ left: -22, right: -22 }}
            interval={0}
            tickFormatter={(v: string, i: number) => {
              const d = parseLocalDate(v);
              if (d.getFullYear() !== goalsYear) return '';
              const prev = i > 0 ? parseLocalDate(series[i - 1].date) : null;
              const changed = !prev || prev.getMonth() !== d.getMonth();
              const label = d.toLocaleString(undefined, { month: 'short' });
              return changed ? (label.charAt(0) || '') : '';
            }}
          />
          <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
          <Tooltip formatter={(v: any) => [String(v), 'Completions']} labelFormatter={(l: any) => `Week of ${l}`} />
          <ReferenceLine y={weeklyAvg} stroke="#9CA3AF" strokeDasharray="3 3" />
          <Bar dataKey="count">
            {series.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.count >= weeklyAvg ? '#16a34a' : '#9CA3AF'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
