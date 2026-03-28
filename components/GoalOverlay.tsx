"use client";

import { Line, LineChart, Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Modal from '@/components/Modal';
import { pad, parseLocalDate } from '@/lib/date';
import { COLORS } from '@/lib/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

function daysUntilYearEnd(year: number) {
    const now = new Date();
    const end = new Date(year, 11, 31);
    const ms = end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.ceil(ms / 86400000));
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
    const daysLeft = daysUntilYearEnd(goal.year);
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
    const done = progressSeries.length ? progressSeries[progressSeries.length - 1].actual : 0;
    const remaining = Math.max(0, goal.target - done);
    const paceNeeded = Math.round((remaining / weeksLeft) * 10) / 10;
    const projection = Math.round(done + weeklyRecentAvg * weeksLeft);
    const pct = goal.target ? Math.min(100, Math.round((done / goal.target) * 100)) : 0;
    const onTrack = projection >= goal.target;
    const activeWeeks = weeklySeries.filter((w) => w.count > 0).length;

    function exportGoalOverlay() {
        const W = CANVAS_WIDTH, H = CANVAS_HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const c = canvas.getContext('2d');
        if (!c) return;
        c.clearRect(0, 0, W, H);

        const accent = COLORS.accent;
        const green = COLORS.success;
        const white = '#ffffff';
        const muted = 'rgba(255,255,255,0.6)';
        const font = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
        const cx = W / 2;

        const shadow = () => { c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 12; c.shadowOffsetY = 4; };
        const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };

        const write = (text: string, size: number, x: number, y: number, opts: { bold?: boolean; color?: string; align?: CanvasTextAlign } = {}) => {
            c.font = `${opts.bold ? '700' : '400'} ${size}px ${font}`;
            c.fillStyle = opts.color || white;
            c.textAlign = opts.align || 'center';
            shadow();
            c.fillText(text, x, y);
            noShadow();
        };

        // --- Layout: bottom-third placement like Strava ---
        const baseY = H * 0.55;

        // Grade badge
        write(goal.grade.toUpperCase(), 120, cx, baseY, { bold: true, color: accent });
        write(`${goal.type.toUpperCase()} GOAL · ${goal.year}`, 36, cx, baseY + 50, { color: muted });

        // Big progress ring (circular arc)
        const ringCx = cx;
        const ringCy = baseY + 220;
        const ringR = 110;
        const ringW = 14;

        // Background ring
        c.beginPath();
        c.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(255,255,255,0.15)';
        c.lineWidth = ringW;
        shadow();
        c.stroke();
        noShadow();

        // Progress arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * Math.min(1, pct / 100));
        c.beginPath();
        c.arc(ringCx, ringCy, ringR, startAngle, endAngle);
        c.strokeStyle = pct >= 100 ? green : accent;
        c.lineWidth = ringW;
        c.lineCap = 'round';
        shadow();
        c.stroke();
        noShadow();
        c.lineCap = 'butt';

        // Center text in ring
        write(`${pct}%`, 64, ringCx, ringCy + 8, { bold: true, color: pct >= 100 ? green : accent });
        write(`${done}/${goal.target}`, 28, ringCx, ringCy + 48, { color: muted });

        // Stats row below ring
        const statsY = ringCy + ringR + 80;
        const statSpacing = W / 4;
        const stats = [
            { label: 'FLASH', value: `${flashRate}%` },
            { label: 'WEEKLY', value: String(weeklyRecentAvg) },
            { label: 'BEST WK', value: String(bestWeek) },
            { label: 'ACTIVE', value: `${activeWeeks}w` },
        ];
        stats.forEach((s, i) => {
            const sx = statSpacing * (i + 0.5);
            write(s.value, 48, sx, statsY, { bold: true });
            write(s.label, 24, sx, statsY + 36, { color: muted });
        });

        // Projection line
        const projY = statsY + 100;
        const projText = onTrack
            ? `On track · projected ${projection} by year end`
            : `${paceNeeded}/wk needed · projected ${projection}`;
        write(projText, 30, cx, projY, { color: onTrack ? green : accent });

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `goal-${goal.year}-${goal.type}-${goal.grade}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }

    return (
        <Modal open onClose={onClose} size="lg" title={`${goal.type} · ${goal.grade} · ${goal.year}`}>
            {/* Hero progress section */}
            <div className="flex flex-col items-center py-4 gap-3">
                {/* Circular progress */}
                <div className="relative" style={{ width: 140, height: 140 }}>
                    <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                        <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border)" strokeWidth="10" />
                        <circle
                            cx="70" cy="70" r="60" fill="none"
                            stroke={pct >= 100 ? COLORS.success : 'var(--accent)'}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${Math.min(1, pct / 100) * 377} 377`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold" style={{ color: pct >= 100 ? COLORS.success : 'var(--accent)' }}>{pct}%</span>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{done}/{goal.target}</span>
                    </div>
                </div>

                {/* Status chips */}
                <div className="flex flex-wrap justify-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{
                        background: onTrack ? `${COLORS.success}18` : `${COLORS.danger}18`,
                        color: onTrack ? COLORS.success : COLORS.danger,
                    }}>
                        {onTrack ? `On track · ~${projection} projected` : `Behind pace · ~${projection} projected`}
                    </span>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }}>
                        {paceNeeded}/wk needed
                    </span>
                </div>
            </div>

            {/* Key stats strip */}
            <div className="grid grid-cols-4 rounded-xl overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                {[
                    { label: 'Flash rate', value: `${flashRate}%` },
                    { label: 'Weekly avg', value: String(weeklyRecentAvg) },
                    { label: 'Best week', value: String(bestWeek) },
                    { label: 'Active wks', value: `${activeWeeks}/${weeklySeries.length}` },
                ].map(({ label, value }) => (
                    <div key={label} className="py-3 text-center">
                        <div className="text-lg font-bold">{value}</div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Progress vs Pace chart */}
            <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Progress vs Pace</h3>
                    <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        <span><span className="inline-block w-2 h-0.5 mr-1 rounded" style={{ background: COLORS.success }} />Actual</span>
                        <span><span className="inline-block w-2 h-0.5 mr-1 rounded" style={{ background: '#9CA3AF' }} />Ideal</span>
                        <span><span className="inline-block w-2 h-0.5 mr-1 rounded" style={{ background: '#f59e0b' }} />Recent</span>
                    </div>
                </div>
                <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressSeries} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                            <XAxis dataKey="date" tick={false} axisLine={false} />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip
                                content={({ payload, label }) => {
                                    if (!payload?.length) return null;
                                    return (
                                        <div className="rounded-xl px-3 py-1.5 text-xs shadow-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                            <div className="font-medium mb-0.5">{label}</div>
                                            {payload.map((p: any) => (
                                                <div key={p.dataKey}>{p.name}: <strong>{Math.round(p.value)}</strong></div>
                                            ))}
                                        </div>
                                    );
                                }}
                            />
                            <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                            <Line type="monotone" dataKey="recentPace" name="Recent Pace" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                            <Line type="monotone" dataKey="actual" name="Actual" stroke={COLORS.success} strokeWidth={2.5} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Weekly completions chart */}
            <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Weekly Completions</h3>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>avg {weeklyAvg}/wk</span>
                </div>
                <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklySeries} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                            <XAxis dataKey="date" tick={false} axisLine={false} />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip
                                content={({ payload, label }) => {
                                    if (!payload?.length) return null;
                                    const dates = byWeekDates.get(String(label)) || [];
                                    return (
                                        <div className="rounded-xl px-3 py-1.5 text-xs shadow-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                            <div className="font-medium">Week of {label}</div>
                                            <div>{payload[0]?.value} sends</div>
                                            {dates.length > 0 && <div className="mt-1" style={{ color: 'var(--muted-foreground)' }}>{dates.join(', ')}</div>}
                                        </div>
                                    );
                                }}
                            />
                            <ReferenceLine y={weeklyAvg} stroke="var(--border)" strokeDasharray="3 3" />
                            <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} opacity={0.85} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Attempts breakdown */}
            <div className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold">Attempts Breakdown</h3>
                <div className="flex gap-1.5">
                    {attemptsDist.map((b) => {
                        const maxCount = Math.max(...attemptsDist.map(d => d.count), 1);
                        const heightPct = Math.max(8, Math.round((b.count / maxCount) * 100));
                        const isFlash = b.bucket === '0';
                        return (
                            <div key={b.bucket} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full rounded-t-md" style={{
                                    height: heightPct * 0.6,
                                    background: isFlash ? COLORS.success : 'var(--accent)',
                                    opacity: isFlash ? 1 : 0.6,
                                }} />
                                <span className="text-sm font-bold">{b.count}</span>
                                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{isFlash ? 'Flash' : `${b.bucket} att`}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recent sends */}
            {goalItems.length > 0 && (
                <div className="mt-5 space-y-2">
                    <h3 className="text-sm font-semibold">Recent Sends</h3>
                    <div className="space-y-1">
                        {goalItems
                            .slice()
                            .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
                            .slice(0, 6)
                            .map((s) => (
                                <div key={s.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg" style={{ background: 'var(--surface-alt)' }}>
                                    <span>{s.date.slice(0, 10)}</span>
                                    <span style={{ color: 'var(--muted-foreground)' }}>
                                        S{s.session} · {s.attempts === 0 ? <span style={{ color: COLORS.success }}>flash</span> : `${s.attempts} att`}
                                        {s.location ? ` · ${s.location}` : ''}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Export button */}
            <div className="mt-5 flex justify-center">
                <button
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                    onClick={exportGoalOverlay}
                >
                    Download Overlay
                </button>
            </div>
        </Modal>
    );
}
