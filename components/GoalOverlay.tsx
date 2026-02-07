"use client";

import { Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
        const c = canvas.getContext('2d') as CanvasRenderingContext2D; if (!c) return;
        c.clearRect(0, 0, W, H);
        // Transparent background for social overlays
        const accent = '#fc4c02';
        const fg = '#ffffff';
        c.textAlign = 'left';
        const write = (text: string, size: number, px: number, py: number, bold = false, color = fg, shadow = true) => {
            c.font = `${bold ? '700' : '400'} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
            c.fillStyle = color;
            if (shadow) { c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 8; c.shadowOffsetX = 0; c.shadowOffsetY = 3; }
            c.fillText(text, px, py);
            if (shadow) { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
        };

        // Compute progress
        const pct = goal.target ? Math.min(100, Math.round((done / goal.target) * 100)) : 0;

        // Layout
        const padX = 96;
        const padY = 200;
        const labelSize = 54;
        const labelGap = 10;
        const leftLabelW = 340; // space on the left for stacked labels (right-aligned within this area)
        const labelPad = 24;    // gap between left labels and meter
        const percentW = 96;    // tighter space for percent to extend meter width
        const meterH = labelSize * 2 + labelGap; // meter height equals stacked labels height
        const meterTop = padY + 160;
        const meterX = padX + leftLabelW + labelPad;
        const meterW = W - padX * 2 - leftLabelW - percentW - labelPad;
        // Single meter bar
        // Bar background
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(meterX, meterTop, meterW, meterH);
        // Fill based on percent
        const fillW = Math.max(0, Math.min(meterW, Math.round(meterW * (Math.max(0, Math.min(100, pct)) / 100))));
        c.fillStyle = accent;
        c.fillRect(meterX, meterTop, fillW, meterH);
        // Value text centered within bar
        c.textAlign = 'center';
        write(`${done}/${goal.target}`, 40, meterX + meterW / 2, meterTop + meterH / 2 + 18, true);
        // Left stacked labels (right-aligned within leftLabelW area)
        c.textAlign = 'right';
        write(`${goal.year}`, labelSize, padX + leftLabelW, meterTop + labelSize, true);
        const goalLabel = `${String(goal.grade).toUpperCase()} GOAL`;
        write(goalLabel, labelSize, padX + leftLabelW, meterTop + labelSize + labelGap + labelSize, true);
        // Percent on the right of the meter, left-aligned with padding
        c.textAlign = 'left';
        write(`${pct}%`, 120, meterX + meterW + 16, meterTop + meterH / 2 + 40, true, accent);
        c.textAlign = 'left';

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
