"use client";

import { Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, Cell } from 'recharts';
import React from 'react';

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysUntilYearEnd(year: number) {
  const now = new Date();
  const end = new Date(year, 11, 31);
  const ms = end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function WeekTooltip({ active, payload, label, datesMap }: { active: boolean; payload?: any[]; label?: string; datesMap: Map<string, string[]> }) {
  if (active && payload && payload.length) {
    const key = String(label || '');
    const dates = datesMap.get(key) || [];
    return (
      <div className="card p-2 text-xs">
        <div className="font-medium">Week of {key}</div>
        <ul className="mt-1 space-y-1">
          {dates.map((d, i) => (<li key={`${d}-${i}`}>{d}</li>))}
          {dates.length === 0 && (<li className="subtle">No completions</li>)}
        </ul>
      </div>
    );
  }
  return null;
}

export default function GoalOverlay({ goal, progressSeries, weeklySeries, weeklyAvg, weeklyRecentAvg, bestWeek, flashPie, attemptsDist, goalItems, byWeekDates, allGoalsForYear, onClose }: {
  goal: { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };
  progressSeries: Array<{ date: string; actual: number; ideal: number; recentPace: number }>;
  weeklySeries: Array<{ date: string; count: number }>;
  weeklyAvg: number;
  weeklyRecentAvg: number;
  bestWeek: number;
  flashPie: { flash: number; nonFlash: number };
  attemptsDist: Array<{ bucket: string; count: number }>;
  goalItems: Array<{ id: string; date: string; session: number; attempts: number; location?: string; notes?: string }>;
  byWeekDates: Map<string, string[]>;
  allGoalsForYear: Array<{ id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number; done: number; pct: number }>;
  onClose: () => void;
}) {
  const total = flashPie.flash + flashPie.nonFlash;
  const flashRate = total ? Math.round((flashPie.flash / total) * 100) : 0;
  const avgAttempts = attemptsDist.reduce((acc, b) => acc + (b.bucket === '0' ? 0 : (b.bucket === '4+' ? 4 : parseInt(b.bucket, 10))) * b.count, 0);
  const avgAttemptsDen = attemptsDist.reduce((acc, b) => acc + b.count, 0);
  const avgAttemptsVal = avgAttemptsDen ? Math.round((avgAttempts / avgAttemptsDen) * 10) / 10 : 0;
  const daysLeft = daysUntilYearEnd(goal.year);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const done = progressSeries.length ? progressSeries[progressSeries.length - 1].actual : 0;
  const projection = Math.round(done + weeklyRecentAvg * weeksLeft);
  const pct = goal.target ? Math.min(100, Math.round((done / goal.target) * 100)) : 0;

  function exportGoalOverlay() {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const accent = '#fc4c02';
    ctx.textAlign = 'center';
    const write = (text: string, size: number, px: number, py: number, bold = false, color = '#ffffff') => {
      ctx.font = `${bold ? '700' : '400'} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = color; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
      ctx.fillText(text, px, py);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    };
    const cx = W / 2, padY = 160;
    write(`Goal ${goal.year} • ${goal.type} • ${goal.grade}`, 80, cx, padY, true);
    write(`${done}/${goal.target}`, 136, cx, padY + 160, true, accent);
    write('Progress', 44, cx, padY + 210);
    write(`(${pct}%)`, 44, cx, padY + 260);
    const writePair = (label: string, value: string, size: number, y: number) => {
      const space = 14;
      ctx.font = `400 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      const labelW = ctx.measureText(label + ': ').width;
      ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      const valueW = ctx.measureText(value).width;
      const totalW = labelW + space + valueW;
      const startX = cx - totalW / 2;
      ctx.textAlign = 'left';
      ctx.font = `400 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
      ctx.fillText(label + ':', startX, y);
      ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = accent;
      ctx.fillText(value, startX + labelW + space, y);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.textAlign = 'center';
    };
    writePair('Recent weekly avg', `${weeklyRecentAvg}`, 48, padY + 330);
    writePair('Best week', `${bestWeek}`, 44, padY + 390);
    writePair('Flash rate', `${flashRate}%`, 44, padY + 450);
    writePair('Avg attempts', `${avgAttemptsVal}`, 44, padY + 490);

    const meters = (allGoalsForYear || []).slice(0, 6);
    if (meters.length) {
      write('Year Goals Progress', 48, cx, padY + 520, true);
      const barW = 720; const barH = 20; const startY = padY + 560; const gapY = 90;
      for (let i = 0; i < meters.length; i++) {
        const g = meters[i];
        const y = startY + i * gapY;
        const x = cx - barW / 2;
        write(`${g.type} • ${g.grade} — ${g.done}/${g.target} (${g.pct}%)`, 38, cx, y - 18);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, y, barW, barH);
        ctx.fillStyle = accent;
        const w = Math.max(0, Math.min(barW, Math.round(barW * ((g.pct || 0) / 100))));
        ctx.fillRect(x, y, w, barH);
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `goal-${goal.year}-${goal.type}-${goal.grade}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  const pieData = [
    { name: 'Flash', value: flashPie.flash },
    { name: 'Non-Flash', value: flashPie.nonFlash },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card max-h-[90vh] w-[95vw] max-w-4xl overflow-auto p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="card-title">Goal • {goal.type} • {goal.grade}</div>
            <div className="subtle">Target: {goal.target} • Year: {goal.year}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-outline" onClick={exportGoalOverlay}>Create Overlay</button>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="mt-3 grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="font-medium mb-2">Progress vs Pace</div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressSeries} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={false} axisLine={false} />
                  <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip formatter={(v: any, n: any) => [String(v), n === 'actual' ? 'Actual' : (n === 'recentPace' ? 'Recent Pace' : 'Ideal')]} labelFormatter={(l: any) => l} />
                  <Legend />
                  <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#9CA3AF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="recentPace" name="Recent Pace" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="subtle mt-1">Done: {done}/{goal.target} ({pct}%) • Recent weekly avg: {weeklyRecentAvg}</div>
          </div>
          <div className="rounded border p-3">
            <div className="font-medium mb-2">Weekly Completions</div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySeries} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={false} axisLine={false} />
                  <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip content={(props: any) => <WeekTooltip {...props} datesMap={byWeekDates} />} />
                  <ReferenceLine y={weeklyAvg} stroke="#9CA3AF" strokeDasharray="3 3" />
                  <Bar dataKey="count" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="subtle mt-1">Avg: {weeklyAvg} • Best week: {bestWeek}</div>
          </div>
          <div className="rounded border p-3">
            <div className="font-medium mb-2">Flash Rate</div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#16a34a' : '#6B7280'} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="subtle mt-1">Flash rate: {flashRate}%</div>
          </div>
          <div className="rounded border p-3">
            <div className="font-medium mb-2">Attempts Distribution</div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attemptsDist} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="bucket" axisLine={false} />
                  <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip formatter={(v: any) => [String(v), 'Climbs']} labelFormatter={(l: any) => `${l} attempts`} />
                  <Bar dataKey="count" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
          <div className="rounded border p-3">
            <div className="font-medium mb-1">Insights</div>
            <ul className="text-sm space-y-1">
              <li><span className="subtle">Pace needed:</span> {Math.max(0, Math.round(((goal.target - done) / Math.max(1, weeksLeft)) * 10) / 10)}/week</li>
              <li><span className="subtle">Projection (weighted):</span> {projection} by year end</li>
              <li><span className="subtle">Flash rate:</span> {flashRate}%</li>
              <li><span className="subtle">Avg attempts:</span> {avgAttemptsVal}</li>
            </ul>
          </div>
          <div className="rounded border p-3">
            <div className="font-medium mb-1">Consistency</div>
            <ul className="text-sm space-y-1">
              <li><span className="subtle">Active weeks:</span> {weeklySeries.filter((w) => w.count > 0).length}/{weeklySeries.length}</li>
              <li><span className="subtle">Best week:</span> {bestWeek} completions</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 grid gap-2 grid-cols-1 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="font-medium mb-1">Top Sessions</div>
            <ul className="text-sm space-y-1">
              {goalItems
                .slice()
                .sort((a, b) => (a.attempts - b.attempts) || (parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()))
                .slice(0, 8)
                .map((s) => (
                  <li key={`${s.id}`} className="flex justify-between">
                    <span>{s.date.slice(0, 10)} • S{s.session} • {s.attempts === 0 ? 'flash' : `${s.attempts} att`}</span>
                    <span className="subtle">{s.location || ''}{s.notes ? ` • ${s.notes}` : ''}</span>
                  </li>
                ))}
              {goalItems.length === 0 && <li className="subtle">No sessions for this goal.</li>}
            </ul>
          </div>
          <div className="rounded border p-3">
            <div className="font-medium mb-1">Goal Context</div>
            <ul className="text-sm space-y-1">
              <li><span className="subtle">Type:</span> {goal.type === 'boulder' ? 'Boulder (V-scale)' : 'Rope (French scale)'}</li>
              <li><span className="subtle">Grade:</span> {goal.grade}</li>
              <li className="subtle">Target is total completions in {goal.year}.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
