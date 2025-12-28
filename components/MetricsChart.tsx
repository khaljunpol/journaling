"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

type Point = { week: string; rate: number };

export default function MetricsChart() {
  const [data, setData] = useState<Point[]>([]);

  useEffect(() => {
    // Simple fetch via logs aggregation (server will aggregate)
    fetch('/api/logs?date=1970-01-01')
      .then(() => fetch('/api/metrics').catch(() => null));
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/metrics');
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    }
    load();
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Consistency per week</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip formatter={(v) => `${Math.round(Number(v) * 100)}%`} />
            <Line type="monotone" dataKey="rate" stroke="#2563eb" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
