"use client";

import type { Activity, CatalogItem, WeightPoint, MoodItem, TimeEntryAny } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pad, localISO, toISODate, weekStartLocal, weekKey } from '@/lib/date';
import { getCache, setCache } from '@/lib/cache';
import { moodEmoji } from '@/lib/mood';

export default function Dashboard() {
    const now = new Date();
    // Date helpers now imported from '@/lib/date'
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const fromISO = `${y}-${pad(m)}-01`;
    const toISO = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayISO = localISO(today);
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 6);
    const from7ISO = localISO(d7);
    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 29);
    const from30ISO = localISO(d30);

    const [account, setAccount] = useState<string>('Alex');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [summary7, setSummary7] = useState<{ exercise: number; caffeine: number; supplements: number; alcohol: number; leisure: number; content: number; stopped: number }>({ exercise: 0, caffeine: 0, supplements: 0, alcohol: 0, leisure: 0, content: 0, stopped: 0 });
    const [doneToday, setDoneToday] = useState(0);
    const [streakDays, setStreakDays] = useState(0);
    const [last7Done, setLast7Done] = useState(0);
    const [last30Done, setLast30Done] = useState(0);
    const [avgWeeklyRate, setAvgWeeklyRate] = useState(0);
    const [bestWeekLabel, setBestWeekLabel] = useState<string | undefined>(undefined);
    const [bestWeekRate, setBestWeekRate] = useState(0);
    const [thisWeekRate, setThisWeekRate] = useState(0);
    const [lastWeekRate, setLastWeekRate] = useState(0);
    const [topActivities30, setTopActivities30] = useState<Array<{ name: string; count: number }>>([]);
    const [recentCompletions, setRecentCompletions] = useState<Array<{ date: string; activityId: string; name: string }>>([]);
    const [weights30, setWeights30] = useState<WeightPoint[]>([]);
    const [highlights30, setHighlights30] = useState<Array<{ date: string; text: string }>>([]);
    const [insights, setInsights] = useState<string[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    // Removed stoppedTop7 in favor of explicit To Stop / To Continue lists
    const [toStopActs, setToStopActs] = useState<Array<{ name: string; count: number; prev: number }>>([]);
    const [toContinueActs, setToContinueActs] = useState<Array<{ name: string; count: number }>>([]);
    const [moodToday, setMoodToday] = useState<number | null>(null);
    const [moodAvg7, setMoodAvg7] = useState<number | null>(null);
    const [mood7, setMood7] = useState<Array<{ date: string; score: number }>>([]);
    const fetchVersionRef = useRef(0);
    const actsCtrlRef = useRef<AbortController | null>(null);
    const dashboardCtrlRef = useRef<AbortController | null>(null);
    const catalogCtrlRef = useRef<AbortController | null>(null);
    const logsTodayCtrlRef = useRef<AbortController | null>(null);
    const logs7CtrlRef = useRef<AbortController | null>(null);
    const logs30CtrlRef = useRef<AbortController | null>(null);
    const metricsCtrlRef = useRef<AbortController | null>(null);
    const weightsCtrlRef = useRef<AbortController | null>(null);
    const highlightsCtrlRef = useRef<AbortController | null>(null);
    const moodsCtrlRef = useRef<AbortController | null>(null);
    const timeCtrlRef = useRef<AbortController | null>(null);
    const timeCatsCtrlRef = useRef<AbortController | null>(null);
    const climbCtrlRef = useRef<AbortController | null>(null);
    const goalsCtrlRef = useRef<AbortController | null>(null);
    const extraWeightsCtrlRef = useRef<AbortController | null>(null);

    // Dashboard snapshots
    const [timeCategories, setTimeCategories] = useState<Array<{ id: string; name: string; color: string; order: number }>>([]);
    const [timeStats, setTimeStats] = useState<{ todayHours: number; todayTop?: { id: number; name: string; count: number; percent: number }; weekTotal: number; weekTop: Array<{ id: number; name: string; count: number }> }>({ todayHours: 0, weekTotal: 0, weekTop: [] });
    const [climbStats, setClimbStats] = useState<{ sessionsThisWeek: number; sessionsLastWeek: number; flashRate30d: number; avgAttempts30d: number }>({ sessionsThisWeek: 0, sessionsLastWeek: 0, flashRate30d: 0, avgAttempts30d: 0 });
    const [moodStats, setMoodStats] = useState<{ weekAvg: number; lastWeekAvg: number; spark: Array<{ date: string; score: number | null }> }>({ weekAvg: 0, lastWeekAvg: 0, spark: [] });
    const [goalStats, setGoalStats] = useState<Array<{ label: string; percent: number; onTrack: 'ahead' | 'on track' | 'behind' }>>([]);
    const [consistency, setConsistency] = useState<{ climbingActiveWeeksYTD: number; timeActiveWeeksYTD: number; moodStreakDays: number; climbingStreakDays: number }>({ climbingActiveWeeksYTD: 0, timeActiveWeeksYTD: 0, moodStreakDays: 0, climbingStreakDays: 0 });
    const [balanceStats, setBalanceStats] = useState<{ todayProductive: number; todayRest: number; weekProductive: number; weekRest: number; sleepToday: number }>({ todayProductive: 0, todayRest: 0, weekProductive: 0, weekRest: 0, sleepToday: 0 });
    const [weeklyHighlights, setWeeklyHighlights] = useState<{ bestClimbWeekCount: number; bestHourWeekCount: number; topWeekCategories: Array<string> }>({ bestClimbWeekCount: 0, bestHourWeekCount: 0, topWeekCategories: [] });
    const [loadingDash, setLoadingDash] = useState(false);
    const [weightTrend, setWeightTrend] = useState<{ ma4: number; prevMa4: number; change: number }>({ ma4: 0, prevMa4: 0, change: 0 });
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [hasData, setHasData] = useState(false);

    const applyFromPayload = (data: any, opts?: { source?: 'fresh' | 'cache'; cachedAt?: string }) => {
        // Base entities
        const activitiesList: Activity[] = Array.isArray(data?.activities) ? data.activities : [];
        setActivities(activitiesList);
        if (Array.isArray(data?.catalog)) setCatalog(data.catalog);

        // Dates (prefer server-provided)
        const dates = (data?.dates && typeof data.dates === 'object') ? data.dates : {};
        const sTodayISO: string = typeof dates?.todayISO === 'string' ? dates.todayISO : todayISO;
        const sFrom7ISO: string = typeof dates?.from7ISO === 'string' ? dates.from7ISO : from7ISO;
        const sFrom30ISO: string = typeof dates?.from30ISO === 'string' ? dates.from30ISO : from30ISO;
        const sWeekFromISO: string = typeof dates?.weekFromISO === 'string' ? dates.weekFromISO : toISODate(weekStartLocal(new Date()));
        const sWeekToISO: string = typeof dates?.weekToISO === 'string' ? dates.weekToISO : sTodayISO;
        const sPrevWeekFromISO: string | undefined = typeof dates?.prevWeekFromISO === 'string' ? dates.prevWeekFromISO : undefined;
        const sPrevWeekToISO: string | undefined = typeof dates?.prevWeekToISO === 'string' ? dates.prevWeekToISO : undefined;

        // Activity logs (last 30 days)
        const logs30: Array<{ date: string; activityId: string; completed: boolean }> = Array.isArray(data?.logs30) ? data.logs30 : [];
        const isInRange = (d: string, a: string, b: string) => d >= a && d <= b;
        const doneTodayVal = logs30.filter(l => l.completed && l.date === sTodayISO).length;
        const doneLast7Val = logs30.filter(l => l.completed && isInRange(l.date, sFrom7ISO, sTodayISO)).length;
        const doneLast30Val = logs30.filter(l => l.completed).length;
        setDoneToday(doneTodayVal);
        setLast7Done(doneLast7Val);
        setLast30Done(doneLast30Val);

        // Weights (8 weeks provided)
        const weights8w: WeightPoint[] = Array.isArray(data?.weights8w) ? data.weights8w : [];
        setWeights30(weights8w);

        // Highlights (30 days)
        const hl30: Array<{ date: string; text: string }> = Array.isArray(data?.highlights30) ? data.highlights30 : [];
        setHighlights30(hl30);

        // Mood (7 days)
        const moods7: MoodItem[] = Array.isArray(data?.moods7) ? data.moods7 : [];
        setMood7(moods7);
        if (moods7.length) {
            const avg = Math.round((moods7.reduce((acc, x) => acc + (Number(x.score) || 0), 0) / moods7.length) * 10) / 10;
            setMoodAvg7(avg);
            setMoodToday(Number(moods7[moods7.length - 1]?.score) || null);
        } else {
            setMoodAvg7(null);
            setMoodToday(null);
        }

        // Weight trend (4 vs prev 4 samples)
        if (weights8w.length >= 5) {
            const last4 = weights8w.slice(-4).map(w => Number(w.weight) || 0);
            const prev4 = weights8w.slice(-8, -4).map(w => Number(w.weight) || 0);
            const ma4 = Math.round((last4.reduce((a, b) => a + b, 0) / (last4.length || 1)) * 10) / 10;
            const prevMa4 = prev4.length ? Math.round((prev4.reduce((a, b) => a + b, 0) / prev4.length) * 10) / 10 : 0;
            const change = Math.round((ma4 - prevMa4) * 10) / 10;
            setWeightTrend({ ma4, prevMa4, change });
        } else {
            setWeightTrend({ ma4: 0, prevMa4: 0, change: 0 });
        }

        // Metrics (weekly activity rates)
        const metrics: any = (data?.metrics && typeof data.metrics === 'object') ? data.metrics : null;
        if (metrics?.summary) {
            setAvgWeeklyRate(Number(metrics.summary.avgRate) || 0);
            setBestWeekLabel(typeof metrics.summary.bestWeek?.week === 'string' ? metrics.summary.bestWeek.week : undefined);
            setBestWeekRate(Number(metrics.summary.bestWeek?.rate) || 0);
            setStreakDays(Number(metrics.summary.currentStreakDays) || 0);
        } else {
            setAvgWeeklyRate(0);
            setBestWeekLabel(undefined);
            setBestWeekRate(0);
        }
        if (Array.isArray(metrics?.weeks)) {
            const byDate = (d: string) => metrics.weeks.find((w: any) => String(w?.date) === d);
            const thisW = byDate(sWeekFromISO);
            const prevW = sPrevWeekFromISO ? byDate(sPrevWeekFromISO) : undefined;
            setThisWeekRate(Number(thisW?.rate) || 0);
            setLastWeekRate(Number(prevW?.rate) || 0);
        } else {
            setThisWeekRate(0);
            setLastWeekRate(0);
        }

        // Time (categories and entries)
        const timeCats: Array<{ id: string; name: string; color: string; order: number }> = Array.isArray(data?.timeCategories) ? data.timeCategories : [];
        const timeY: TimeEntryAny[] = Array.isArray(data?.timeY) ? data.timeY as TimeEntryAny[] : [];
        setTimeCategories(timeCats);
        const numCat = (c: number | string) => Number(c);
        const nameForCat = (cid: number) => {
            const found = timeCats.find(c => String(c.id) === String(cid));
            return found ? found.name : String(cid);
        };
        const countByCat = (items: Array<{ category: number | string }>) => {
            const m = new Map<number, number>();
            for (const it of items) {
                const k = numCat(it.category);
                m.set(k, (m.get(k) || 0) + 1);
            }
            return m;
        };
        const tToday = timeY.filter(t => t.date === sTodayISO);
        const tWeek = timeY.filter(t => isInRange(t.date, sWeekFromISO, sWeekToISO));
        const todayHours = tToday.length;
        const weekTotal = tWeek.length;
        const todayCounts = countByCat(tToday);
        let todayTop: { id: number; name: string; count: number; percent: number } | undefined;
        if (todayCounts.size) {
            let maxId = -1, maxVal = -1;
            for (const [cid, cnt] of todayCounts.entries()) { if (cnt > maxVal) { maxVal = cnt; maxId = cid; } }
            todayTop = { id: maxId, name: nameForCat(maxId), count: maxVal, percent: todayHours ? Math.round((maxVal / todayHours) * 100) : 0 };
        }
        const weekCounts = countByCat(tWeek);
        const weekTop = Array.from(weekCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cid, cnt]) => ({ id: cid, name: nameForCat(cid), count: cnt }));
        setTimeStats({ todayHours, todayTop, weekTotal, weekTop });

        // Balance snapshot
        const prodNames = ['work', 'hobbies / projects', 'exercise / sports', 'chores', 'travel', 'content'];
        const restNames = ['relaxation / leisure', 'friends', 'wife', 'party', 'brain rot / misc'];
        const idsForNames = (names: string[]) => new Set(names.map(n => {
            const f = timeCats.find(c => c.name.toLowerCase() === n.toLowerCase());
            return f ? Number(f.id) : NaN;
        }).filter(x => !Number.isNaN(x)) as number[]);
        const prodIds = idsForNames(prodNames);
        const restIds = idsForNames(restNames);
        const countForSet = (items: typeof tToday, idSet: Set<number>) => items.filter(t => idSet.has(numCat(t.category))).length;
        const todayProductive = countForSet(tToday, prodIds);
        const todayRest = countForSet(tToday, restIds);
        const weekProductive = countForSet(tWeek, prodIds);
        const weekRest = countForSet(tWeek, restIds);
        const sleepCat = timeCats.find(c => c.name.toLowerCase() === 'sleep');
        const sleepId = sleepCat ? Number(sleepCat.id) : 0;
        const sleepToday = tToday.filter(t => numCat(t.category) === sleepId).length;
        setBalanceStats({ todayProductive, todayRest, weekProductive, weekRest, sleepToday });

        // Climbing stats
        const climb30: Array<{ id: string; date: string; session: number; type: string; grade: string; attempts: number }> = Array.isArray(data?.climb30) ? data.climb30 : [];
        const inWeek = (date: string, from: string | undefined, to: string | undefined) => {
            if (!from || !to) return false; return isInRange(date, from, to);
        };
        const sessionsThisWeek = new Set(climb30.filter(c => inWeek(c.date, sWeekFromISO, sWeekToISO)).map(c => c.date)).size;
        const sessionsLastWeek = new Set(climb30.filter(c => inWeek(c.date, sPrevWeekFromISO, sPrevWeekToISO)).map(c => c.date)).size;
        const flashCnt = climb30.filter(c => Number(c.attempts) === 1).length;
        const flashRate30d = climb30.length ? Math.round((flashCnt / climb30.length) * 100) : 0;
        const avgAttempts30d = climb30.length ? Math.round((climb30.reduce((acc, c) => acc + (Number(c.attempts) || 0), 0) / climb30.length) * 10) / 10 : 0;
        setClimbStats({ sessionsThisWeek, sessionsLastWeek, flashRate30d, avgAttempts30d });

        // Goals progress
        const goals: Array<{ year: number; type: string; grade: string; target: number }> = Array.isArray(data?.goals) ? data.goals : [];
        const climbY: Array<{ date: string; type: string; grade: string }> = Array.isArray(data?.climbY) ? data.climbY : [];
        const currentYear = new Date().getFullYear();
        const yearGoals = goals.filter(g => Number(g.year) === currentYear);
        const nowMonth = new Date().getMonth() + 1; // 1..12
        const expectedPct = Math.round((nowMonth / 12) * 100);
        const gs = yearGoals.map(g => {
            const done = climbY.filter(c => c.type === g.type && c.grade === g.grade).length;
            const pct = Math.min(100, Math.round((done / (Number(g.target) || 1)) * 100));
            const onTrack = pct >= expectedPct ? 'on track' : 'behind';
            return { label: `${g.type[0].toUpperCase() + g.type.slice(1)} ${g.grade}`, percent: pct, onTrack } as { label: string; percent: number; onTrack: 'ahead' | 'on track' | 'behind' };
        });
        setGoalStats(gs);

        // Consistency
        const weekKeyFor = (iso: string) => weekKey(new Date(iso));
        const climbWeeksYTD = new Set(climbY.filter(c => new Date(c.date).getFullYear() === currentYear).map(c => weekKeyFor(c.date))).size;
        const timeY2: TimeEntryAny[] = Array.isArray(data?.timeY) ? data.timeY as TimeEntryAny[] : [];
        const timeWeeksYTD = new Set(timeY2.filter(t => new Date(t.date).getFullYear() === currentYear).map(t => weekKeyFor(t.date))).size;
        const climbDatesSet = new Set(climbY.map(c => c.date));
        let streak = 0; // consecutive days with climbing ending today
        let cursor = new Date(sTodayISO);
        for (let i = 0; i < 60; i++) { // limit to 60 days for safety
            const iso = toISODate(cursor);
            if (climbDatesSet.has(iso)) { streak += 1; cursor.setDate(cursor.getDate() - 1); } else { break; }
        }
        setConsistency({ climbingActiveWeeksYTD: climbWeeksYTD, timeActiveWeeksYTD: timeWeeksYTD, moodStreakDays: Number(metrics?.summary?.currentStreakDays) || 0, climbingStreakDays: streak });

        // Weekly highlights (last 12 weeks)
        const twelveAgo: string = typeof dates?.twelveWeeksAgoISO === 'string' ? dates.twelveWeeksAgoISO : sWeekFromISO;
        const climbWeeks = new Map<string, number>();
        for (const c of climbY) { if (c.date >= twelveAgo) { const k = weekKeyFor(c.date); climbWeeks.set(k, (climbWeeks.get(k) || 0) + 1); } }
        const bestClimbWeekCount = Array.from(climbWeeks.values()).reduce((m, v) => Math.max(m, v), 0);
        const timeWeeks = new Map<string, number>();
        for (const t of timeY2) { if (t.date >= twelveAgo) { const k = weekKeyFor(t.date); timeWeeks.set(k, (timeWeeks.get(k) || 0) + 1); } }
        const bestHourWeekCount = Array.from(timeWeeks.values()).reduce((m, v) => Math.max(m, v), 0);
        const weekTopCats = weekTop.map(x => x.name);
        setWeeklyHighlights({ bestClimbWeekCount, bestHourWeekCount, topWeekCategories: weekTopCats });

        // Updated timestamp
        if (opts?.source === 'cache') {
            const t = opts.cachedAt ? new Date(opts.cachedAt).toLocaleTimeString() : 'cache';
            setLastUpdated(t);
        } else {
            setLastUpdated(new Date().toLocaleTimeString());
        }
        setHasData(true);
    };

    useEffect(() => {
        // Try cookie first, then localStorage
        const cookieAccount = (() => {
            try {
                const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/);
                return m ? decodeURIComponent(m[1]) : null;
            } catch { return null; }
        })();
        const lsAccount = typeof window !== 'undefined' ? localStorage.getItem('account') : null;
        setAccount(cookieAccount || lsAccount || 'Alex');

        const setFromSources = (detail?: string) => {
            const cookieAcc = (() => {
                try {
                    const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/);
                    return m ? decodeURIComponent(m[1]) : null;
                } catch { return null; }
            })();
            const lsAcc = typeof window !== 'undefined' ? localStorage.getItem('account') : null;
            setAccount(detail || cookieAcc || lsAcc || 'Alex');
        };
        const onAccountChange = (e: Event) => setFromSources((e as CustomEvent<string>).detail);
        const onStorage = () => setFromSources();
        window.addEventListener('account-change', onAccountChange as EventListener);
        window.addEventListener('storage', onStorage as EventListener);
        return () => {
            window.removeEventListener('account-change', onAccountChange as EventListener);
            window.removeEventListener('storage', onStorage as EventListener);
        };
    }, []);

    useEffect(() => {
        // On account change, abort in-flight requests and clear state before reloading
        fetchVersionRef.current += 1;
        if (actsCtrlRef.current) actsCtrlRef.current.abort();
        if (dashboardCtrlRef.current) dashboardCtrlRef.current.abort();
        if (catalogCtrlRef.current) catalogCtrlRef.current.abort();
        if (logsTodayCtrlRef.current) logsTodayCtrlRef.current.abort();
        if (logs7CtrlRef.current) logs7CtrlRef.current.abort();
        if (logs30CtrlRef.current) logs30CtrlRef.current.abort();
        if (metricsCtrlRef.current) metricsCtrlRef.current.abort();
        if (weightsCtrlRef.current) weightsCtrlRef.current.abort();
        if (highlightsCtrlRef.current) highlightsCtrlRef.current.abort();
        if (moodsCtrlRef.current) moodsCtrlRef.current.abort();
        if (timeCtrlRef.current) timeCtrlRef.current.abort();
        if (timeCatsCtrlRef.current) timeCatsCtrlRef.current.abort();
        if (climbCtrlRef.current) climbCtrlRef.current.abort();
        if (goalsCtrlRef.current) goalsCtrlRef.current.abort();
        if (extraWeightsCtrlRef.current) extraWeightsCtrlRef.current.abort();
        setActivities([]);
        setDoneToday(0);
        setStreakDays(0);
        setLast7Done(0);
        setLast30Done(0);
        setAvgWeeklyRate(0);
        setBestWeekLabel(undefined);
        setBestWeekRate(0);
        setThisWeekRate(0);
        setLastWeekRate(0);
        setTopActivities30([]);
        setRecentCompletions([]);
        setWeights30([]);
        setHighlights30([]);
        setInsights([]);
        setMoodToday(null);
        setMoodAvg7(null);
        setHasData(false);

        // Try local cache immediately
        try {
            const cacheKey = `dashboard:${account}`;
            const cached = getCache<any>(cacheKey);
            if (cached && cached.data) {
                applyFromPayload(cached.data, { source: 'cache', cachedAt: cached.cachedAt });
            }
        } catch { }

        const load = async () => {
            try {
                dashboardCtrlRef.current = new AbortController();
                const res = await fetch(`/api/dashboard?account=${encodeURIComponent(account)}`, { signal: dashboardCtrlRef.current.signal });
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                applyFromPayload(data, { source: 'fresh' });
                try {
                    const cacheKey = `dashboard:${account}`;
                    setCache(cacheKey, data);
                } catch { }
            } catch {
                // fall back to cleared baseline already set above
            }
        };

        if (account) { setLoadingDash(true); load().finally(() => setLoadingDash(false)); }
    }, [account]);

    const last7Expected = activities.length * 7;
    const maData = (() => {
        const win = 5;
        return weights30.map((p, i) => {
            const start = Math.max(0, i - win + 1);
            const slice = weights30.slice(start, i + 1);
            const avg = slice.reduce((acc, x) => acc + x.weight, 0) / (slice.length || 1);
            return { date: p.date, weight: p.weight, ma: Math.round(avg * 10) / 10 };
        });
    })();

    return (
        <main key={account} className="space-y-8">
            <h2 className="text-xl font-semibold">Dashboard</h2>
            {lastUpdated ? (<div className="subtle">Updated at {lastUpdated}</div>) : null}
            {/* Quick Stats: shows immediately, uses ellipses while loading */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div className="card p-3">
                    <div className="subtle">Activities</div>
                    <div className="text-lg font-semibold">{hasData ? activities.length : '…'}</div>
                </div>
                <div className="card p-3">
                    <div className="subtle">Today</div>
                    <div className="text-lg font-semibold">{hasData ? `${doneToday}/${activities.length} done` : '…'}</div>
                </div>
                <div className="card p-3">
                    <div className="subtle">Last 7 Days</div>
                    <div className="text-lg font-semibold">{hasData ? (activities.length ? Math.round((last7Done / (activities.length * 7)) * 100) : 0) : '…'}%</div>
                </div>
                <div className="card p-3">
                    <div className="subtle">Last 30 Days</div>
                    <div className="text-lg font-semibold">{hasData ? last30Done : '…'}</div>
                </div>
            </div>
            {/* Ordered groups for clear top-to-bottom reading on mobile */}
            <h3 className="text-base font-semibold">Mood & Weight</h3>
            {loadingDash && (
                <div className="subtle">Loading dashboard data…</div>
            )}
            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
                {/* Detailed Mood card */}
                <div className="card p-4">
                    <div className="card-title">Mood</div>
                    <div className="text-2xl font-semibold">
                        {typeof moodToday === 'number' ? (
                            <span title={`${moodToday}/10`}>{moodEmoji(moodToday)} {moodToday}/10</span>
                        ) : '-'}
                    </div>
                    <div className="subtle">7-day avg: {typeof moodAvg7 === 'number' ? `${moodAvg7}/10` : '-'}</div>
                    <div className="mt-1 subtle">
                        {typeof moodToday === 'number' && typeof moodAvg7 === 'number' ? (() => {
                            const delta = Math.round((moodToday - moodAvg7) * 10) / 10;
                            if (Math.abs(delta) < 0.1) return 'Today is on your weekly average.';
                            return `Today is ${delta > 0 ? 'above' : 'below'} avg by ${Math.abs(delta)}`;
                        })() : (mood7.length >= 2 ? (() => {
                            const first = mood7[0].score;
                            const last = mood7[mood7.length - 1].score;
                            const trend = Math.round((last - first) * 10) / 10;
                            return `7-day trend ${trend >= 0 ? 'up' : 'down'} by ${Math.abs(trend)}`;
                        })() : 'Log your mood to see trends.')}
                    </div>
                    <div className="mt-2 h-12 w-full">
                        {mood7.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mood7} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="date" tick={false} axisLine={false} />
                                    <YAxis tick={false} axisLine={false} domain={[0, 10]} />
                                    <Tooltip formatter={(v: any) => [`${v}/10`, 'Mood']} labelFormatter={(l: any) => new Date(l).toLocaleDateString()} />
                                    {typeof moodAvg7 === 'number' ? (
                                        <ReferenceLine y={moodAvg7} stroke="#9CA3AF" strokeDasharray="3 3" />
                                    ) : null}
                                    <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : null}
                    </div>

                    {/* Mood Overview supplemental */}
                    <div className="card-title">Weight Trend (30d)</div>
                    <div className="text-2xl font-semibold">{weights30.length >= 2 ? `${(Math.round((weights30[weights30.length - 1].weight - weights30[0].weight) * 10) / 10)} kg` : '-'}</div>
                    <div className="subtle">latest - earliest</div>
                    <div className="mt-2 h-20 w-full">
                        {weights30.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={maData} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="date" tick={false} axisLine={false} />
                                    <YAxis tick={false} axisLine={false} domain={['auto', 'auto']} />
                                    <Tooltip formatter={(v: any) => [`${v} kg`, 'Weight']} labelFormatter={(l: any) => l} />
                                    <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="ma" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : null}
                    </div>
                </div>
                {/* Weight Trend summary (4w vs prev) */}
                <div className="card p-4">
                    <div className="card-title">Weight Trend (4w vs prev)</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>4-week MA: {weightTrend.ma4}</li>
                        <li>Prev 4-week MA: {weightTrend.prevMa4}</li>
                        <li>Change: {weightTrend.change >= 0 ? `+${weightTrend.change}` : `${weightTrend.change}`}</li>
                    </ul>
                </div>
            </div>

            <h3 className="text-base font-semibold">Time</h3>

            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
                <div className="card p-4">
                    <div className="card-title">Time Snapshot</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>Hours today: {timeStats.todayHours}</li>
                        <li>Top today: {timeStats.todayTop ? `${timeStats.todayTop.name} (${timeStats.todayTop.percent}%)` : '—'}</li>
                        <li>Hours this week: {timeStats.weekTotal}</li>
                        <li>Top categories (week): {timeStats.weekTop.length > 0 ? timeStats.weekTop.map((x) => x.name).join(', ') : '—'}</li>
                    </ul>
                </div>
                <div className="card p-4">
                    <div className="card-title">Time Balance</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>Today: {balanceStats.todayProductive} productive • {balanceStats.todayRest} rest</li>
                        <li>Week: {balanceStats.weekProductive} productive • {balanceStats.weekRest} rest</li>
                        <li>Sleep today: {balanceStats.sleepToday}h</li>
                    </ul>
                </div>
            </div>

            <h3 className="text-base font-semibold">Climbing</h3>
            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
                <div className="card p-4">
                    <div className="card-title">Climbing Snapshot</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>Sessions this week: {climbStats.sessionsThisWeek}</li>
                        <li>Sessions last week: {climbStats.sessionsLastWeek}</li>
                        <li>Flash rate (30d): {climbStats.flashRate30d}%</li>
                        <li>Avg attempts (30d): {climbStats.avgAttempts30d}</li>
                    </ul>
                </div>
                <div className="card p-4">
                    <div className="card-title">Goals Progress ({new Date().getFullYear()})</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {goalStats.length > 0 ? goalStats.map((g, i) => (
                            <li key={i}>{g.label}: {g.percent}% • {g.onTrack}</li>
                        )) : <li>—</li>}
                    </ul>
                </div>
            </div>

            <h3 className="text-base font-semibold">Highlights & Consistency</h3>
            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
                <div className="card p-4">
                    <div className="card-title">Weekly Highlights</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>Best week (climbs, 12w): {weeklyHighlights.bestClimbWeekCount}</li>
                        <li>Best week (hours, 12w): {weeklyHighlights.bestHourWeekCount}</li>
                        <li>Top week categories: {weeklyHighlights.topWeekCategories.length > 0 ? weeklyHighlights.topWeekCategories.join(', ') : '—'}</li>
                    </ul>
                </div>
                <div className="card p-4">
                    <div className="card-title">Consistency</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>Active weeks YTD (Climbing): {consistency.climbingActiveWeeksYTD}</li>
                        <li>Active weeks YTD (Time): {consistency.timeActiveWeeksYTD}</li>
                        <li>Mood streak: {consistency.moodStreakDays} days</li>
                        <li>Climbing streak: {consistency.climbingStreakDays} days</li>
                    </ul>
                </div>
            </div>
            <h3 className="text-base font-semibold">Activities</h3>
            <div className="card p-4 space-y-6">
                <div>
                    <div className="card-title">Overview</div>
                    <div className="mt-2 grid gap-3 grid-cols-2 sm:grid-cols-3">
                        <div className="card p-3">
                            <div className="subtle">Activities</div>
                            <div className="text-lg font-semibold">{activities.length}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Today</div>
                            <div className="text-lg font-semibold">{doneToday}/{activities.length} done</div>
                            <div className="subtle">Streak: {streakDays} days</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Last 7 Days</div>
                            <div className="text-lg font-semibold">{last7Expected ? Math.round((last7Done / last7Expected) * 100) : 0}%</div>
                            <div className="subtle">{last7Done}/{last7Expected} completions</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Avg Weekly Rate</div>
                            <div className="text-lg font-semibold">{Math.round(avgWeeklyRate * 100)}%</div>
                            <div className="subtle">Best: {bestWeekLabel ? `${Math.round(bestWeekRate * 100)}% (${bestWeekLabel})` : '-'}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">This vs Last Week</div>
                            <div className="text-lg font-semibold">{Math.round(thisWeekRate * 100)}% / {Math.round(lastWeekRate * 100)}%</div>
                            <div className="subtle">current / previous</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Last 30 Days</div>
                            <div className="text-lg font-semibold">{last30Done}</div>
                            <div className="subtle">total completions</div>
                        </div>
                    </div>
                </div>
                <div>
                    {/* Removed heavy recent completions list to reduce fetching */}
                </div>
                <div>
                    {/* Removed category summary (7d) to streamline page */}
                </div>
                <div>
                    {/* Removed top activities (30d) to reduce data volume */}
                </div>
                <div>
                    {/* Removed statuses (7d) lists to simplify dashboard */}
                </div>
                <div>
                    {/* Removed insights & suggestions to cut heavy processing */}
                </div>
            </div>



        </main>
    );
}
