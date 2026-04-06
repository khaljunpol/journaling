"use client";

import { getCache, setCache } from '@/lib/cache';
import { localISO, toISODate, weekKey, weekStartLocal } from '@/lib/date';
import { computeAttentionSignals, computeMoodActivityCorrelation, computeWeeklySummary } from '@/lib/insights';
import { moodColor, moodEmoji } from '@/lib/mood';
import type { Activity, MoodItem, Sidequest, TimeEntryAny, WeightPoint } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ─── Skeleton primitive ───────────────────────────────────────────────────────
function Sk({ w = 'w-16', h = 'h-4' }: { w?: string; h?: string }) {
    return <div className={`${w} ${h} rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse`} />;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
    label, value, sub, trend, loading, href,
}: {
    label: string;
    value: string | number;
    sub?: string;
    trend?: 'up' | 'down' | 'flat' | null;
    loading?: boolean;
    href?: string;
}) {
    const arrow = trend === 'up' ? '↑ ' : trend === 'down' ? '↓' : null;
    const arrowColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-400' : '';
    const inner = (
        <div className={`card p-4 flex flex-col gap-1${href ? ' cursor-pointer hover:ring-2 hover:ring-(--ring) transition-shadow' : ''}`}>
            <div className="subtle text-xs uppercase tracking-wide">{label}</div>
            {loading ? (
                <Sk w="w-20" h="h-7" />
            ) : (
                <div className="text-2xl font-bold leading-none flex items-baseline gap-1">
                    {value}
                    {arrow && <span className={`text-sm font-semibold ${arrowColor}`}>{arrow}</span>}
                </div>
            )}
            {sub && !loading && <div className="subtle">{sub}</div>}
        </div>
    );
    if (href) return <Link href={href} className="block">{inner}</Link>;
    return inner;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = 'bg-blue-500', label, sub, onTrack }: {
    pct: number; color?: string; label: string; sub?: string;
    onTrack?: 'ahead' | 'on track' | 'behind';
}) {
    const dot = onTrack === 'on track' || onTrack === 'ahead'
        ? 'bg-emerald-500'
        : 'bg-amber-400';
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="flex items-center gap-1.5 subtle">
                    {onTrack && <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />}
                    {pct}%
                </span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
            </div>
            {sub && <div className="subtle text-xs">{sub}</div>}
        </div>
    );
}

// ─── Balance bar ──────────────────────────────────────────────────────────────
function BalanceBar({ productive, rest, sleep, total }: {
    productive: number; rest: number; sleep: number; total: number;
}) {
    if (!total) return <div className="subtle text-xs">No data</div>;
    const pPct = Math.round((productive / total) * 100);
    const rPct = Math.round((rest / total) * 100);
    const sPct = Math.round((sleep / total) * 100);
    return (
        <div className="space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pPct}%` }} title={`Productive ${pPct}%`} />
                <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${rPct}%` }} title={`Rest ${rPct}%`} />
                <div className="bg-neutral-300 dark:bg-neutral-600 transition-all duration-500" style={{ width: `${sPct}%` }} title={`Sleep ${sPct}%`} />
            </div>
            <div className="flex gap-4 text-xs subtle">
                <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />Productive {productive}h</span>
                <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-400 mr-1" />Rest {rest}h</span>
                <span><span className="inline-block w-2 h-2 rounded-sm bg-neutral-300 dark:bg-neutral-600 mr-1" />Sleep {sleep}h</span>
            </div>
        </div>
    );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-3 mt-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">{title}</h3>
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
    const now = new Date();
    const y = now.getFullYear();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayISO = localISO(today);
    const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
    const from7ISO = localISO(d7);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
    const from30ISO = localISO(d30);

    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [hasData, setHasData] = useState(false);
    const dashCtrl = useRef<AbortController | null>(null);

    // ── Activity state
    const [activities, setActivities] = useState<Activity[]>([]);
    const [logs30Raw, setLogs30Raw] = useState<Array<{ date: string; activityId: string; completed: boolean }>>([]);
    const [doneToday, setDoneToday] = useState(0);
    const [last7Done, setLast7Done] = useState(0);
    const [last30Done, setLast30Done] = useState(0);
    const [streakDays, setStreakDays] = useState(0);
    const [avgWeeklyRate, setAvgWeeklyRate] = useState(0);
    const [thisWeekRate, setThisWeekRate] = useState(0);
    const [lastWeekRate, setLastWeekRate] = useState(0);
    const [bestWeekLabel, setBestWeekLabel] = useState<string | undefined>();
    const [bestWeekRate, setBestWeekRate] = useState(0);

    // ── Mood state
    const [moodToday, setMoodToday] = useState<number | null>(null);
    const [moodAvg7, setMoodAvg7] = useState<number | null>(null);
    const [mood7, setMood7] = useState<Array<{ date: string; score: number }>>([]);
    const [moodAll, setMoodAll] = useState<MoodItem[]>([]);
    const [moodPrevAvg, setMoodPrevAvg] = useState<number | null>(null);

    // ── Weight state
    const [weights, setWeights] = useState<WeightPoint[]>([]);
    const [weightTrend, setWeightTrend] = useState<{ ma4: number; prevMa4: number; change: number }>({ ma4: 0, prevMa4: 0, change: 0 });

    // ── Time state
    const [timeCategories, setTimeCategories] = useState<Array<{ id: string; name: string; color: string; order: number }>>([]);
    const [timeStats, setTimeStats] = useState<{ todayHours: number; weekTotal: number; weekTop: Array<{ name: string; count: number }>; balance: { productive: number; rest: number; sleep: number } }>({ todayHours: 0, weekTotal: 0, weekTop: [], balance: { productive: 0, rest: 0, sleep: 0 } });

    // ── Sidequests state
    const [sidequests, setSidequests] = useState<Sidequest[]>([]);

    // ── Climbing state
    const [climbStats, setClimbStats] = useState<{ sessionsThisWeek: number; sessionsLastWeek: number; flashRate30d: number; avgAttempts30d: number }>({ sessionsThisWeek: 0, sessionsLastWeek: 0, flashRate30d: 0, avgAttempts30d: 0 });
    const [goalStats, setGoalStats] = useState<Array<{ label: string; percent: number; onTrack: 'ahead' | 'on track' | 'behind' }>>([]);
    const [consistency, setConsistency] = useState<{ climbingWeeksYTD: number; timeWeeksYTD: number; moodStreakDays: number; climbingStreakDays: number }>({ climbingWeeksYTD: 0, timeWeeksYTD: 0, moodStreakDays: 0, climbingStreakDays: 0 });

    // ── Apply API payload ─────────────────────────────────────────────────────
    const applyFromPayload = (data: any, opts?: { source?: 'cache' | 'fresh'; cachedAt?: string }) => {
        const activitiesList: Activity[] = Array.isArray(data?.activities) ? data.activities : [];
        setActivities(activitiesList);

        const dates = data?.dates ?? {};
        const sTodayISO: string = dates.todayISO ?? todayISO;
        const sFrom7ISO: string = dates.from7ISO ?? from7ISO;
        const sFrom30ISO: string = dates.from30ISO ?? from30ISO;
        const sWeekFromISO: string = dates.weekFromISO ?? toISODate(weekStartLocal(new Date()));
        const sWeekToISO: string = dates.weekToISO ?? sTodayISO;
        const sPrevWeekFrom: string | undefined = dates.prevWeekFromISO;
        const sPrevWeekTo: string | undefined = dates.prevWeekToISO;

        const inRange = (d: string, a: string, b: string) => d >= a && d <= b;

        // Activity logs
        const logs30: Array<{ date: string; activityId: string; completed: boolean }> = Array.isArray(data?.logs30) ? data.logs30 : [];
        setLogs30Raw(logs30);
        setDoneToday(logs30.filter(l => l.completed && l.date === sTodayISO).length);
        setLast7Done(logs30.filter(l => l.completed && inRange(l.date, sFrom7ISO, sTodayISO)).length);
        setLast30Done(logs30.filter(l => l.completed).length);

        // Metrics
        const metrics: any = data?.metrics ?? null;
        if (metrics?.summary) {
            setAvgWeeklyRate(Number(metrics.summary.avgRate) || 0);
            setBestWeekLabel(typeof metrics.summary.bestWeek?.week === 'string' ? metrics.summary.bestWeek.week : undefined);
            setBestWeekRate(Number(metrics.summary.bestWeek?.rate) || 0);
            setStreakDays(Number(metrics.summary.currentStreakDays) || 0);
        }
        if (Array.isArray(metrics?.weeks)) {
            const byDate = (d: string) => metrics.weeks.find((w: any) => w?.date === d);
            setThisWeekRate(Number(byDate(sWeekFromISO)?.rate) || 0);
            setLastWeekRate(Number(sPrevWeekFrom ? byDate(sPrevWeekFrom)?.rate : undefined) || 0);
        }

        // Mood
        const moods7: MoodItem[] = Array.isArray(data?.moods7) ? data.moods7 : [];
        setMood7(moods7);
        const moodsPrev: MoodItem[] = Array.isArray(data?.moodsPrev7) ? data.moodsPrev7 : [];
        setMoodAll([...moodsPrev, ...moods7]);
        if (moods7.length) {
            const avg = Math.round((moods7.reduce((a, x) => a + (Number(x.score) || 0), 0) / moods7.length) * 10) / 10;
            setMoodAvg7(avg);
            // today's mood = entry matching today's date, or last entry
            const todayEntry = moods7.find(m => m.date === sTodayISO);
            setMoodToday(todayEntry ? Number(todayEntry.score) : null);
        } else {
            setMoodAvg7(null); setMoodToday(null);
        }
        if (moodsPrev.length) {
            const avg = Math.round((moodsPrev.reduce((a, x) => a + (Number(x.score) || 0), 0) / moodsPrev.length) * 10) / 10;
            setMoodPrevAvg(avg);
        } else {
            setMoodPrevAvg(null);
        }

        // Weight
        const weights8w: WeightPoint[] = Array.isArray(data?.weights8w) ? data.weights8w : [];
        setWeights(weights8w);
        if (weights8w.length >= 5) {
            const last4 = weights8w.slice(-4).map(w => Number(w.weight) || 0);
            const prev4 = weights8w.slice(-8, -4).map(w => Number(w.weight) || 0);
            const ma4 = Math.round((last4.reduce((a, b) => a + b, 0) / last4.length) * 10) / 10;
            const prevMa4 = prev4.length ? Math.round((prev4.reduce((a, b) => a + b, 0) / prev4.length) * 10) / 10 : 0;
            setWeightTrend({ ma4, prevMa4, change: Math.round((ma4 - prevMa4) * 10) / 10 });
        } else {
            setWeightTrend({ ma4: 0, prevMa4: 0, change: 0 });
        }

        // Time
        const timeCats: Array<{ id: string; name: string; color: string; order: number }> = Array.isArray(data?.timeCategories) ? data.timeCategories : [];
        const timeY: TimeEntryAny[] = Array.isArray(data?.timeY) ? data.timeY as TimeEntryAny[] : [];
        setTimeCategories(timeCats);

        const numCat = (c: number | string) => Number(c);
        const nameForCat = (cid: number) => timeCats.find(c => String(c.id) === String(cid))?.name ?? String(cid);
        const tToday = timeY.filter(t => t.date === sTodayISO);
        const tWeek = timeY.filter(t => inRange(t.date, sWeekFromISO, sWeekToISO));

        const countByCat = (items: typeof tToday) => {
            const m = new Map<number, number>();
            for (const it of items) { const k = numCat(it.category); m.set(k, (m.get(k) || 0) + 1); }
            return m;
        };
        const weekCounts = countByCat(tWeek);
        const weekTop = Array.from(weekCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cid, cnt]) => ({ name: nameForCat(cid), count: cnt }));

        // Balance
        const prodNames = ['work', 'hobbies / projects', 'exercise / sports', 'chores', 'travel', 'content'];
        const restNames = ['relaxation / leisure', 'friends', 'wife', 'party', 'brain rot / misc'];
        const idsFor = (names: string[]) => new Set(names.map(n => { const f = timeCats.find(c => c.name.toLowerCase() === n.toLowerCase()); return f ? Number(f.id) : NaN; }).filter(x => !isNaN(x)));
        const prodIds = idsFor(prodNames);
        const restIds = idsFor(restNames);
        const sleepCat = timeCats.find(c => c.name.toLowerCase() === 'sleep');
        const sleepId = sleepCat ? Number(sleepCat.id) : NaN;
        const countSet = (items: typeof tToday, ids: Set<number>) => items.filter(t => ids.has(numCat(t.category))).length;
        const weekProductive = countSet(tWeek, prodIds);
        const weekRest = countSet(tWeek, restIds);
        const weekSleep = isNaN(sleepId) ? 0 : tWeek.filter(t => numCat(t.category) === sleepId).length;
        setTimeStats({ todayHours: tToday.length, weekTotal: tWeek.length, weekTop, balance: { productive: weekProductive, rest: weekRest, sleep: weekSleep } });

        // Climbing
        const climb30: Array<{ id: string; date: string; session: number; type: string; grade: string; attempts: number }> = Array.isArray(data?.climb30) ? data.climb30 : [];
        const climbY: Array<{ date: string; type: string; grade: string }> = Array.isArray(data?.climbY) ? data.climbY : [];
        const inWeek = (d: string, f?: string, t?: string) => !!f && !!t && inRange(d, f, t);
        setClimbStats({
            sessionsThisWeek: new Set(climb30.filter(c => inWeek(c.date, sWeekFromISO, sWeekToISO)).map(c => c.date)).size,
            sessionsLastWeek: new Set(climb30.filter(c => inWeek(c.date, sPrevWeekFrom, sPrevWeekTo)).map(c => c.date)).size,
            flashRate30d: climb30.length ? Math.round((climb30.filter(c => Number(c.attempts) === 1).length / climb30.length) * 100) : 0,
            avgAttempts30d: climb30.length ? Math.round((climb30.reduce((a, c) => a + (Number(c.attempts) || 0), 0) / climb30.length) * 10) / 10 : 0,
        });

        // Goals
        const goals: Array<{ year: number; type: string; grade: string; target: number }> = Array.isArray(data?.goals) ? data.goals : [];
        const nowMonth = new Date().getMonth() + 1;
        const expectedPct = Math.round((nowMonth / 12) * 100);
        setGoalStats(goals.filter(g => Number(g.year) === y).map(g => {
            const done = climbY.filter(c => c.type === g.type && c.grade === g.grade).length;
            const pct = Math.min(100, Math.round((done / (Number(g.target) || 1)) * 100));
            return { label: `${g.type[0].toUpperCase() + g.type.slice(1)} ${g.grade}`, percent: pct, onTrack: pct >= expectedPct ? 'on track' : 'behind' } as const;
        }));

        // Consistency
        const weekKeyFor = (iso: string) => weekKey(new Date(iso));
        const climbWeeksYTD = new Set(climbY.filter(c => new Date(c.date).getFullYear() === y).map(c => weekKeyFor(c.date))).size;
        const timeWeeksYTD = new Set(timeY.filter(t => new Date(t.date).getFullYear() === y).map(t => weekKeyFor(t.date))).size;
        const climbDates = new Set(climbY.map(c => c.date));
        let cStreak = 0;
        const cur = new Date(sTodayISO);
        for (let i = 0; i < 60; i++) { const iso = toISODate(cur); if (climbDates.has(iso)) { cStreak++; cur.setDate(cur.getDate() - 1); } else break; }
        setConsistency({ climbingWeeksYTD: climbWeeksYTD, timeWeeksYTD, moodStreakDays: Number(metrics?.summary?.currentStreakDays) || 0, climbingStreakDays: cStreak });

        // Sidequests
        setSidequests(Array.isArray(data?.sidequests) ? data.sidequests : []);

        setLastUpdated(opts?.source === 'cache' && opts.cachedAt ? new Date(opts.cachedAt).toLocaleTimeString() : new Date().toLocaleTimeString());
        setHasData(true);
    };

    // ── Data load ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (dashCtrl.current) dashCtrl.current.abort();
        setHasData(false);

        try {
            const cached = getCache<unknown>('dashboard');
            if (cached?.data) applyFromPayload(cached.data, { source: 'cache', cachedAt: cached.cachedAt });
        } catch { }

        const load = async () => {
            try {
                dashCtrl.current = new AbortController();
                const res = await fetch('/api/dashboard', { signal: dashCtrl.current.signal });
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                applyFromPayload(data, { source: 'fresh' });
                try { setCache('dashboard', data); } catch { }
            } catch { }
        };

        setLoading(true);
        load().finally(() => setLoading(false));
    }, []);

    // ── Derived values ────────────────────────────────────────────────────────
    const last7Expected = activities.length * 7;
    const last7Pct = last7Expected ? Math.round((last7Done / last7Expected) * 100) : 0;
    const actWeekDelta: 'up' | 'down' | 'flat' | null = !hasData ? null : thisWeekRate > lastWeekRate ? 'up' : thisWeekRate < lastWeekRate ? 'down' : 'flat';
    const moodDelta: 'up' | 'down' | 'flat' | null = moodAvg7 !== null && moodPrevAvg !== null
        ? moodAvg7 > moodPrevAvg ? 'up' : moodAvg7 < moodPrevAvg ? 'down' : 'flat'
        : null;
    const weightDelta: 'up' | 'down' | 'flat' | null = weightTrend.change > 0.05 ? 'up' : weightTrend.change < -0.05 ? 'down' : weightTrend.ma4 ? 'flat' : null;

    const maData = weights.map((p, i) => {
        const slice = weights.slice(Math.max(0, i - 4), i + 1);
        return { date: p.date, weight: p.weight, ma: Math.round((slice.reduce((a, x) => a + x.weight, 0) / slice.length) * 10) / 10 };
    });

    // ── Insights ─────────────────────────────────────────────────────────────
    const weeklySummary = useMemo(() => {
        if (!hasData) return '';
        return computeWeeklySummary({
            moodAvg7,
            moodPrevAvg,
            thisWeekRate,
            lastWeekRate,
            climbSessionsThisWeek: climbStats.sessionsThisWeek,
            balance: timeStats.balance,
        });
    }, [hasData, moodAvg7, moodPrevAvg, thisWeekRate, lastWeekRate, climbStats.sessionsThisWeek, timeStats.balance]);

    const signals = useMemo(() => {
        if (!hasData) return [];
        return computeAttentionSignals({
            moods7: mood7,
            streakDays,
            climbSessionsThisWeek: climbStats.sessionsThisWeek,
            climbSessionsLastWeek: climbStats.sessionsLastWeek,
            goalStats,
            moodAvg7,
            moodPrevAvg,
        });
    }, [hasData, mood7, streakDays, climbStats, goalStats, moodAvg7, moodPrevAvg]);

    const correlation = useMemo(() => {
        if (!hasData) return null;
        return computeMoodActivityCorrelation(moodAll, logs30Raw, activities);
    }, [hasData, moodAll, logs30Raw, activities]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <main className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Dashboard</h2>
                {lastUpdated && <span className="subtle text-xs">Updated {lastUpdated}</span>}
            </div>

            {/* ═══ TIER 1: GLANCE ═══════════════════════════════════════════ */}
            <div className="card p-4 space-y-3">
                {!hasData ? (
                    <div className="space-y-2"><Sk w="w-3/4" h="h-5" /><Sk w="w-48" h="h-4" /></div>
                ) : (
                    <>
                        <div className="text-sm leading-relaxed font-medium">{weeklySummary}</div>
                        <div className="flex items-center gap-4 flex-wrap">
                            {/* Mood inline */}
                            {typeof moodToday === 'number' && (
                                <Link href="/mood" className="flex items-center gap-1.5 text-sm" style={{ color: moodColor(moodToday) }}>
                                    <span className="text-xl">{moodEmoji(moodToday)}</span>
                                    <span className="font-semibold">{moodToday}/10</span>
                                </Link>
                            )}
                            {/* Mood sparkline */}
                            {mood7.length >= 3 && (
                                <div className="h-6 w-24 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={mood7} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                            <Line type="monotone" dataKey="score" strokeWidth={1.5} dot={false} stroke={moodAvg7 !== null ? moodColor(Math.round(moodAvg7)) : '#60a5fa'} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                            {/* Activity rate chip */}
                            {thisWeekRate > 0 && (
                                <Link href="/activities" className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}>
                                    {Math.round(thisWeekRate * 100)}% activities
                                </Link>
                            )}
                            {/* Climbing chip */}
                            {climbStats.sessionsThisWeek > 0 && (
                                <Link href="/climbing" className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}>
                                    {climbStats.sessionsThisWeek}x climbing
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══ TIER 2: SIGNALS ══════════════════════════════════════════ */}
            {hasData && signals.length > 0 && (
                <div className="space-y-2">
                    {signals.map((s, i) => (
                        <div
                            key={i}
                            className="rounded-lg px-4 py-2.5 text-sm"
                            style={{
                                borderLeft: `3px solid ${s.type === 'warning' ? '#f59e0b' : '#22c55e'}`,
                                background: 'var(--surface)',
                            }}
                        >
                            {s.message}
                        </div>
                    ))}
                </div>
            )}
            {hasData && signals.length === 0 && (
                <div className="subtle text-xs text-center py-1">All on track.</div>
            )}

            {/* ═══ TIER 3: DEEP DIVE ═══════════════════════════════════════ */}

            {/* ── MOOD & WEIGHT ─────────────────────────────────────────────── */}
            <SectionHeader title="Mood & Weight" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {/* Mood card */}
                <div className="card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold">Mood — last 7 days</div>
                        {moodAvg7 !== null && (
                            <span className="text-sm font-medium" style={{ color: moodColor(moodAvg7) }}>
                                avg {moodAvg7}/10 {moodDelta === 'up' ? '↑' : moodDelta === 'down' ? '↓' : ''}
                            </span>
                        )}
                    </div>
                    {!hasData ? (
                        <div className="h-24 flex items-center justify-center"><Sk w="w-full" h="h-16" /></div>
                    ) : mood7.length ? (
                        <div className="h-24 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mood7} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                                    <YAxis tick={false} axisLine={false} tickLine={false} domain={[0, 10]} />
                                    <Tooltip
                                        formatter={(v: any) => [`${v}/10`, 'Mood']}
                                        labelFormatter={(l: any) => new Date(l).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        contentStyle={{ fontSize: 12 }}
                                    />
                                    {moodAvg7 !== null && (
                                        <ReferenceLine y={moodAvg7} stroke="#9CA3AF" strokeDasharray="3 3" strokeWidth={1} />
                                    )}
                                    <Line
                                        type="monotone" dataKey="score" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                                        activeDot={{ r: 4 }}
                                        stroke={moodAvg7 !== null ? moodColor(Math.round(moodAvg7)) : '#60a5fa'}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-24 flex items-center justify-center subtle text-sm">No mood data yet</div>
                    )}
                    {/* Cross-domain insight */}
                    {correlation && correlation.sufficient && (
                        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-alt)' }}>
                            On days you complete &ge;75% of activities, avg mood is <strong>{correlation.highDayAvg}</strong> vs <strong>{correlation.lowDayAvg}</strong> on other days.
                        </div>
                    )}
                    {moodPrevAvg !== null && moodAvg7 !== null && (
                        <div className="subtle text-xs">
                            Previous week avg: {moodPrevAvg}/10
                            {' · '}
                            {moodAvg7 > moodPrevAvg ? `+${Math.round((moodAvg7 - moodPrevAvg) * 10) / 10} improvement` : moodAvg7 < moodPrevAvg ? `${Math.round((moodAvg7 - moodPrevAvg) * 10) / 10} vs last week` : 'Same as last week'}
                        </div>
                    )}
                </div>

                {/* Weight card — subtle trend line */}
                <div className="card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold">Weight — 8 weeks</div>
                        {weights.length >= 2 && (
                            <span className={`text-sm font-medium ${weightTrend.change < 0 ? 'text-emerald-500' : weightTrend.change > 0 ? 'text-red-400' : 'subtle'}`}>
                                {weightTrend.change >= 0 ? '+' : ''}{weightTrend.change} kg (4w)
                            </span>
                        )}
                    </div>
                    {!hasData ? (
                        <div className="h-24 flex items-center justify-center"><Sk w="w-full" h="h-16" /></div>
                    ) : weights.length ? (
                        <div className="h-24 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={maData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                                    <YAxis tick={false} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                                    <Tooltip
                                        formatter={(v: any, name?: string) => [`${v} kg`, name === 'ma' ? '5-pt avg' : 'Weight']}
                                        labelFormatter={(l: any) => l}
                                        contentStyle={{ fontSize: 12 }}
                                    />
                                    <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={1.5} dot={false} />
                                    <Line type="monotone" dataKey="ma" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-24 flex items-center justify-center subtle text-sm">No weight data yet</div>
                    )}
                    {weightTrend.ma4 > 0 && (
                        <div className="subtle text-xs">
                            4-week avg: {weightTrend.ma4} kg · Prev 4-week: {weightTrend.prevMa4} kg
                        </div>
                    )}
                </div>
            </div>

            {/* ── ACTIVITIES — collapsed to single card ────────────────────── */}
            <SectionHeader title="Activities" />
            <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <Link href="/activities" className="font-semibold hover:underline">Weekly Completion</Link>
                    {hasData && (
                        <span className={`text-sm font-medium ${actWeekDelta === 'up' ? 'text-emerald-500' : actWeekDelta === 'down' ? 'text-red-400' : 'subtle'}`}>
                            {Math.round(thisWeekRate * 100)}% {actWeekDelta === 'up' ? '↑' : actWeekDelta === 'down' ? '↓' : ''}
                        </span>
                    )}
                </div>
                {!hasData ? (
                    <Sk w="w-full" h="h-4" />
                ) : (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        <div>
                            <span className="subtle">7-day:</span>{' '}
                            <span className="font-medium">{last7Pct}%</span>
                            <span className="subtle ml-1">({last7Done}/{last7Expected})</span>
                        </div>
                        <div>
                            <span className="subtle">Last week:</span>{' '}
                            <span className="font-medium">{Math.round(lastWeekRate * 100)}%</span>
                        </div>
                        {streakDays > 0 && (
                            <div>
                                <span className="subtle">Streak:</span>{' '}
                                <span className="font-medium">{streakDays}d</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── TIME ─────────────────────────────────────────────────────── */}
            <SectionHeader title="Time" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="card p-4 space-y-3">
                    <div className="font-semibold">This Week</div>
                    <div className="flex gap-6">
                        <div>
                            <div className="subtle text-xs uppercase tracking-wide">Hours logged</div>
                            {!hasData ? <Sk w="w-12" h="h-7" /> : <div className="text-2xl font-bold">{timeStats.weekTotal}</div>}
                        </div>
                        <div>
                            <div className="subtle text-xs uppercase tracking-wide">Today</div>
                            {!hasData ? <Sk w="w-10" h="h-7" /> : <div className="text-2xl font-bold">{timeStats.todayHours}</div>}
                        </div>
                    </div>
                    {hasData && timeStats.weekTop.length > 0 && (
                        <div className="space-y-1">
                            <div className="subtle text-xs">Top categories this week</div>
                            <div className="flex flex-wrap gap-2">
                                {timeStats.weekTop.map((c, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}>
                                        {c.name} · {c.count}h
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="card p-4 space-y-3">
                    <div className="font-semibold">Weekly Balance</div>
                    {!hasData ? (
                        <div className="space-y-2"><Sk w="w-full" h="h-3" /><Sk w="w-32" h="h-3" /></div>
                    ) : (
                        <BalanceBar
                            productive={timeStats.balance.productive}
                            rest={timeStats.balance.rest}
                            sleep={timeStats.balance.sleep}
                            total={timeStats.balance.productive + timeStats.balance.rest + timeStats.balance.sleep}
                        />
                    )}
                </div>
            </div>

            {/* ── CLIMBING (with consistency merged in) ─────────────────────── */}
            <SectionHeader title="Climbing" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="card p-4 space-y-4">
                    <div className="font-semibold">Sessions</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="subtle text-xs uppercase tracking-wide">This week</div>
                            {!hasData ? <Sk w="w-10" h="h-7" /> : <div className="text-2xl font-bold">{climbStats.sessionsThisWeek}</div>}
                        </div>
                        <div>
                            <div className="subtle text-xs uppercase tracking-wide">Last week</div>
                            {!hasData ? <Sk w="w-10" h="h-7" /> : (
                                <div className="text-2xl font-bold flex items-baseline gap-1">
                                    {climbStats.sessionsLastWeek}
                                    {hasData && climbStats.sessionsThisWeek !== climbStats.sessionsLastWeek && (
                                        <span className={`text-sm ${climbStats.sessionsThisWeek > climbStats.sessionsLastWeek ? 'text-emerald-500' : 'text-red-400'}`}>
                                            {climbStats.sessionsThisWeek > climbStats.sessionsLastWeek ? '↑' : '↓'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="subtle text-xs uppercase tracking-wide">Flash rate (30d)</div>
                            {!hasData ? <Sk w="w-12" h="h-7" /> : <div className="text-2xl font-bold">{climbStats.flashRate30d}%</div>}
                        </div>
                        <div>
                            <div className="subtle text-xs uppercase tracking-wide">Avg attempts (30d)</div>
                            {!hasData ? <Sk w="w-10" h="h-7" /> : <div className="text-2xl font-bold">{climbStats.avgAttempts30d}</div>}
                        </div>
                    </div>
                    {/* Merged consistency */}
                    <div className="flex gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-sm">
                        <div><span className="subtle">Weeks YTD:</span> <span className="font-medium">{consistency.climbingWeeksYTD}</span></div>
                        <div><span className="subtle">Streak:</span> <span className="font-medium">{consistency.climbingStreakDays}d</span></div>
                    </div>
                </div>

                {/* Goals */}
                <div className="card p-4 space-y-4">
                    <div className="font-semibold">Goals {y}</div>
                    {!hasData ? (
                        <div className="space-y-3"><Sk w="w-full" h="h-4" /><Sk w="w-full" h="h-4" /><Sk w="w-3/4" h="h-4" /></div>
                    ) : goalStats.length > 0 ? (
                        <div className="space-y-4">
                            {goalStats.map((g, i) => (
                                <ProgressBar
                                    key={i}
                                    label={g.label}
                                    pct={g.percent}
                                    onTrack={g.onTrack}
                                    color={g.onTrack === 'behind' ? 'bg-amber-400' : 'bg-emerald-500'}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="subtle text-sm">No goals set for {y}</div>
                    )}
                </div>
            </div>
            {/* ── SIDEQUESTS ───────────────────────────────────────────────── */}
            <SectionHeader title="Sidequests" />
            <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="font-semibold">Year goals &amp; challenges</div>
                    <Link href="/sidequests" className="text-xs subtle hover:underline">View all →</Link>
                </div>
                {!hasData ? (
                    <div className="space-y-2"><Sk w="w-full" h="h-4" /><Sk w="w-3/4" h="h-4" /></div>
                ) : sidequests.length === 0 ? (
                    <div className="subtle text-sm">
                        No sidequests yet.{' '}
                        <Link href="/sidequests" className="underline" style={{ color: 'var(--accent)' }}>Add one →</Link>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-4 flex-wrap text-sm">
                            <div>
                                <span className="subtle">Active: </span>
                                <span className="font-semibold">{sidequests.filter(s => !s.completedAt).length}</span>
                            </div>
                            <div>
                                <span className="subtle">Done: </span>
                                <span className="font-semibold">{sidequests.filter(s => !!s.completedAt).length}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {sidequests.filter(s => !s.completedAt).slice(0, 4).map((sq) => (
                                <div key={sq.id} className="flex items-center gap-2 text-sm">
                                    <span
                                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                                        style={{
                                            background: sq.type === 'oneoff' ? 'color-mix(in oklab, #6366f1 15%, transparent)' :
                                                sq.type === 'milestone' ? 'color-mix(in oklab, #f59e0b 15%, transparent)' :
                                                    sq.type === 'pb' ? 'color-mix(in oklab, #10b981 15%, transparent)' :
                                                        sq.type === 'timed' ? 'color-mix(in oklab, #3b82f6 15%, transparent)' :
                                                            'color-mix(in oklab, #ec4899 15%, transparent)',
                                            color: sq.type === 'oneoff' ? '#6366f1' :
                                                sq.type === 'milestone' ? '#d97706' :
                                                    sq.type === 'pb' ? '#059669' :
                                                        sq.type === 'timed' ? '#2563eb' : '#db2777',
                                        }}
                                    >{sq.type}</span>
                                    <span className="flex-1 truncate">{sq.title}</span>
                                    {sq.milestones && (
                                        <span className="subtle text-xs tabular-nums">
                                            {sq.milestones.filter(m => m.completedAt).length}/{sq.milestones.length}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {sidequests.filter(s => !s.completedAt).length > 4 && (
                                <Link href="/sidequests" className="text-xs subtle hover:underline block">
                                    +{sidequests.filter(s => !s.completedAt).length - 4} more active
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
