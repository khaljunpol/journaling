"use client";

import type { Activity, CatalogItem, Log, Week, WeightPoint } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';

export default function Dashboard() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekStartLocal = (d: Date) => {
        const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const day = x.getDay();
        const diff = (day === 0 ? -6 : 1 - day);
        x.setDate(x.getDate() + diff);
        return x;
    };
    const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekKey = (d: Date) => {
        const ws = weekStartLocal(d);
        return `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`;
    };
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
    const moodEmoji = (s: number) => {
        const map: Record<number, string> = {
            0: '😭', 1: '😢', 2: '☹️', 3: '🙁', 4: '😕',
            5: '😐', 6: '🙂', 7: '😊', 8: '😃', 9: '😁', 10: '🤩'
        };
        return map[Math.max(0, Math.min(10, Math.round(s)))] || '😐';
    };
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
    const [weightTrend, setWeightTrend] = useState<{ ma4: number; prevMa4: number; change: number }>({ ma4: 0, prevMa4: 0, change: 0 });

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
        setMood7([]);
        setTimeCategories([]);
        setTimeStats({ todayHours: 0, weekTotal: 0, weekTop: [] });
        setClimbStats({ sessionsThisWeek: 0, sessionsLastWeek: 0, flashRate30d: 0, avgAttempts30d: 0 });
        setMoodStats({ weekAvg: 0, lastWeekAvg: 0, spark: [] });
        setGoalStats([]);
        setConsistency({ climbingActiveWeeksYTD: 0, timeActiveWeeksYTD: 0, moodStreakDays: 0, climbingStreakDays: 0 });
        setBalanceStats({ todayProductive: 0, todayRest: 0, weekProductive: 0, weekRest: 0, sleepToday: 0 });
        setWeeklyHighlights({ bestClimbWeekCount: 0, bestHourWeekCount: 0, topWeekCategories: [] });
        setWeightTrend({ ma4: 0, prevMa4: 0, change: 0 });
    }, [account]);

    useEffect(() => {
        async function load() {
            const v = fetchVersionRef.current;
            let currentActs: Activity[] = [];
            let allActs: Activity[] = [];
            let catalogItems: CatalogItem[] = [];
            let weightSeries: WeightPoint[] = [];
            let highlightsItems: Array<{ date: string; text: string }> = [];
            let streakLocal = 0;
            // Keep local copies of logs for filtering stop-target ticks later
            let logsTodayItems: Log[] = [];
            let logs7Items: Log[] = [];
            let logs30Items: Log[] = [];
            // Local series to avoid relying on async state mid-load
            let moodLast7Series: Array<{ date: string; score: number }> = [];
            let weekTopNamesLocal: Array<string> = [];

            // Try aggregated fetch first to reduce API calls
            try {
                dashboardCtrlRef.current = new AbortController();
                const res = await fetch(`/api/dashboard?account=${encodeURIComponent(account)}`, { signal: dashboardCtrlRef.current.signal });
                if (res.ok) {
                    const data = await res.json();
                    // activities
                    allActs = Array.isArray(data.activities) ? data.activities.map((a: any) => ({
                        ...a,
                        status: a?.status === 'stopped' ? 'to stop' : (a?.status === 'active' ? 'to continue' : (a?.status || 'to continue')),
                    })) : [];
                    currentActs = allActs.filter((a) => (a.status || 'to continue') === 'to continue');
                    setActivities(currentActs);
                    // catalog
                    catalogItems = Array.isArray(data.catalog) ? data.catalog : [];
                    setCatalog(catalogItems);
                    // logs30 -> derive today & 7d
                    logs30Items = Array.isArray(data.logs30) ? data.logs30 : [];
                    const todayISO = String(data?.dates?.todayISO || '');
                    const from7ISO = String(data?.dates?.from7ISO || '');
                    logsTodayItems = logs30Items.filter((l: any) => String(l.date) === todayISO);
                    const last7Set = new Set<string>();
                    {
                        const d = new Date(todayISO);
                        for (let i = 6; i >= 0; i--) {
                            const dd = new Date(d);
                            dd.setDate(dd.getDate() - i);
                            const pad = (n: number) => String(n).padStart(2, '0');
                            const iso = `${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`;
                            last7Set.add(iso);
                        }
                    }
                    logs7Items = logs30Items.filter((l: any) => last7Set.has(String(l.date)));
                    setDoneToday((logsTodayItems || []).filter((l) => l.completed).length);
                    setLast7Done((logs7Items || []).filter((l) => l.completed).length);
                    const done30 = (logs30Items || []).filter((l) => l.completed);
                    setLast30Done(done30.length);
                    const nameMap: Record<string, string> = Object.fromEntries((currentActs || []).map((a) => [String(a.id), a.name]));
                    const byAct: Record<string, number> = {};
                    for (const l of done30) { const key = String(l.activityId); byAct[key] = (byAct[key] || 0) + 1; }
                    const top = Object.entries(byAct).map(([id, count]) => ({ name: nameMap[id] || id, count })).sort((a, b) => b.count - a.count).slice(0, 3);
                    setTopActivities30(top);
                    // recent completions
                    const seen = new Set<string>();
                    const recent: Array<{ date: string; activityId: string; name: string }> = [];
                    for (const l of done30.slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))) {
                        const date = String(l.date); const actId = String(l.activityId); const k = `${date}-${actId}`; if (seen.has(k)) continue; seen.add(k);
                        recent.push({ date, activityId: actId, name: nameMap[actId] || actId }); if (recent.length >= 5) break;
                    }
                    setRecentCompletions(recent);
                    // weights: use 8w range for both 30d chart and 4w vs prev
                    const weights8w = Array.isArray(data.weights8w) ? data.weights8w : [];
                    const cleanW = weights8w.filter((p: any) => Number.isFinite(p?.weight));
                    cleanW.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
                    setWeights30(cleanW.filter((p: any) => new Date(String(p.date)) >= new Date(String(data?.dates?.from30ISO || ''))));
                    // highlights
                    highlightsItems = Array.isArray(data.highlights30) ? data.highlights30.filter((i: any) => i && i.date) : [];
                    setHighlights30(highlightsItems);
                    // moods
                    const moods7 = Array.isArray(data.moods7) ? data.moods7 : [];
                    const validM = moods7.filter((i: any) => typeof i?.score === 'number');
                    const sortedM = validM.slice().sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
                    moodLast7Series = sortedM;
                    const avg7 = sortedM.length ? (sortedM.reduce((acc: number, i: any) => acc + (i.score || 0), 0) / sortedM.length) : null;
                    setMoodAvg7(avg7 !== null ? Math.round(avg7 * 10) / 10 : null);
                    const todayMood = sortedM.find((i: any) => String(i.date) === todayISO)?.score ?? null;
                    setMoodToday(typeof todayMood === 'number' ? todayMood : null);
                    setMood7(sortedM);
                    // metrics
                    const metrics = data.metrics || null;
                    streakLocal = metrics?.summary?.currentStreakDays || 0;
                    setAvgWeeklyRate(metrics?.summary?.avgRate || 0);
                    setStreakDays(streakLocal);
                    setBestWeekLabel(metrics?.summary?.bestWeek?.week);
                    setBestWeekRate(metrics?.summary?.bestWeek?.rate || 0);
                    const weeks: Week[] = Array.isArray(metrics?.weeks) ? metrics.weeks : [];
                    const n = weeks.length;
                    setThisWeekRate(n ? weeks[n - 1]?.rate || 0 : 0);
                    setLastWeekRate(n > 1 ? weeks[n - 2]?.rate || 0 : 0);
                    // time categories + timeY derived for week/today
                    const timeCats = Array.isArray(data.timeCategories) ? data.timeCategories : [];
                    setTimeCategories(timeCats);
                    const timeY = Array.isArray(data.timeY) ? data.timeY : [];
                    const timeDay = timeY.filter((e: any) => String(e.date) === todayISO);
                    const ws = new Date(String(data?.dates?.weekFromISO));
                    const we = new Date(String(data?.dates?.weekToISO));
                    const timeWeek = timeY.filter((e: any) => { const d = new Date(String(e.date)); return d >= ws && d <= we; });
                    // compute time stats
                    try {
                        const todayHours = Array.isArray(timeDay) ? timeDay.length : 0;
                        const dayDist = new Map<number, number>();
                        for (const e of Array.isArray(timeDay) ? timeDay : []) { const c = Number(e?.category); if (Number.isFinite(c)) dayDist.set(c, (dayDist.get(c) || 0) + 1); }
                        let todayTop: { id: number; name: string; count: number; percent: number } | undefined = undefined;
                        if (dayDist.size > 0 && todayHours > 0) {
                            const [topId, topCount] = Array.from(dayDist.entries()).sort((a, b) => b[1] - a[1])[0];
                            const fallbackNames: Record<number, string> = { 0:'sleep',1:'work',2:'hobbies / projects',3:'freelance',4:'exercise / sports',5:'friends',6:'relaxation and leisure',7:'wife',8:'family',9:'chores',10:'travel',11:'brain rot / misc' };
                            const cat = timeCats.find((x: any) => String(x.id) === String(topId));
                            const name = cat?.name || fallbackNames[topId] || String(topId);
                            todayTop = { id: topId, name, count: topCount, percent: Math.round((topCount / todayHours) * 100) };
                        }
                        const weekTotal = Array.isArray(timeWeek) ? timeWeek.length : 0;
                        const weekDist = new Map<number, number>();
                        for (const e of Array.isArray(timeWeek) ? timeWeek : []) { const c = Number(e?.category); if (Number.isFinite(c)) weekDist.set(c, (weekDist.get(c) || 0) + 1); }
                        const fallbackNames: Record<number, string> = { 0:'sleep',1:'work',2:'hobbies / projects',3:'freelance',4:'exercise / sports',5:'friends',6:'relaxation and leisure',7:'wife',8:'family',9:'chores',10:'travel',11:'brain rot / misc' };
                        const weekTop = Array.from(weekDist.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ id, name: (timeCats.find((x: any) => String(x.id) === String(id))?.name) || fallbackNames[id] || String(id), count }));
                        weekTopNamesLocal = weekTop.map((x) => x.name);
                        setTimeStats({ todayHours, todayTop, weekTotal, weekTop });
                    } catch { setTimeStats({ todayHours: 0, weekTotal: 0, weekTop: [] }); }
                    // time balance
                    try {
                        const restNames = new Set(['sleep', 'relaxation and leisure', 'friends', 'family', 'wife', 'travel', 'brain rot / misc']);
                        const productiveNames = new Set(['work', 'hobbies / projects', 'freelance', 'exercise / sports', 'chores']);
                        const catNameById = new Map<number, string>();
                        for (const c of timeCats) { const idNum = Number(c.id); if (Number.isFinite(idNum)) catNameById.set(idNum, String(c.name).toLowerCase()); }
                        const productiveIds = new Set([1,2,3,4,9]);
                        const restIds = new Set([0,5,6,7,8,10,11]);
                        const classify = (catId: number) => { const name = (catNameById.get(catId) || '').toLowerCase(); if (restNames.has(name) || restIds.has(catId)) return 'rest'; if (productiveNames.has(name) || productiveIds.has(catId)) return 'productive'; return 'other'; };
                        let todayProductive = 0, todayRest = 0, sleepToday = 0;
                        for (const e of Array.isArray(timeDay) ? timeDay : []) { const cid = Number(e?.category); const cls = classify(cid); if (cls === 'productive') todayProductive += 1; else if (cls === 'rest') todayRest += 1; if ((catNameById.get(cid) || '') === 'sleep' || cid === 0) sleepToday += 1; }
                        let weekProductive = 0, weekRest = 0;
                        for (const e of Array.isArray(timeWeek) ? timeWeek : []) { const cid = Number(e?.category); const cls = classify(cid); if (cls === 'productive') weekProductive += 1; else if (cls === 'rest') weekRest += 1; }
                        setBalanceStats({ todayProductive, todayRest, weekProductive, weekRest, sleepToday });
                    } catch { setBalanceStats({ todayProductive: 0, todayRest: 0, weekProductive: 0, weekRest: 0, sleepToday: 0 }); }
                    // climbing stats from 30d
                    const climb30 = Array.isArray(data.climb30) ? data.climb30 : [];
                    try {
                        const countSessions = (arr: any[]) => { const set = new Set<string>(); for (const x of (Array.isArray(arr) ? arr : [])) { const date = String(x?.date || '').slice(0, 10); const sess = Number(x?.session) || 0; if (date && sess) set.add(`${date}-${sess}`); } return set.size; };
                        const ws = new Date(String(data?.dates?.weekFromISO)); const we = new Date(String(data?.dates?.weekToISO));
                        const prevWs = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7); const prevWe = new Date(prevWs.getFullYear(), prevWs.getMonth(), prevWs.getDate() + 6);
                        const climbWeek = climb30.filter((x: any) => { const d = new Date(String(x?.date).slice(0,10)); return d >= ws && d <= we; });
                        const climbPrev = climb30.filter((x: any) => { const d = new Date(String(x?.date).slice(0,10)); return d >= prevWs && d <= prevWe; });
                        const sessionsThisWeek = countSessions(climbWeek); const sessionsLastWeek = countSessions(climbPrev);
                        let flashRate30d = 0; let avgAttempts30d = 0;
                        if (Array.isArray(climb30) && climb30.length > 0) {
                            const total = climb30.length; const flashes = climb30.filter((x: any) => Number(x?.attempts) === 0).length; flashRate30d = Math.round((flashes / total) * 100);
                            const attemptsList = climb30.map((x: any) => Number(x?.attempts)).filter((a) => Number.isFinite(a) && a > 0);
                            avgAttempts30d = attemptsList.length > 0 ? Number((attemptsList.reduce((s, v) => s + v, 0) / attemptsList.length).toFixed(2)) : 0;
                        }
                        setClimbStats({ sessionsThisWeek, sessionsLastWeek, flashRate30d, avgAttempts30d });
                    } catch { setClimbStats({ sessionsThisWeek: 0, sessionsLastWeek: 0, flashRate30d: 0, avgAttempts30d: 0 }); }
                    // mood overview weekly vs last week
                    try {
                        const ws = new Date(String(data?.dates?.weekFromISO)); const we = new Date(String(data?.dates?.weekToISO));
                        const prevWs = new Date(String(data?.dates?.prevWeekFromISO)); const prevWe = new Date(String(data?.dates?.prevWeekToISO));
                        const weekAvg = (() => { const weekItems = (moodLast7Series || []).filter((p) => { const d = new Date(String(p.date)); return d >= ws && d <= we; }); return weekItems.length ? Number((weekItems.reduce((s, x) => s + (Number(x?.score) || 0), 0) / weekItems.length).toFixed(2)) : 0; })();
                        const lastWeekAvg = (() => { const prevItems = (Array.isArray(data?.moodsPrev7) ? data.moodsPrev7 : []).filter((p: any) => typeof p?.score === 'number'); return prevItems.length ? Number((prevItems.reduce((s: number, x: any) => s + (Number(x?.score) || 0), 0) / prevItems.length).toFixed(2)) : 0; })();
                        const spark = (moodLast7Series || []).map((p) => ({ date: p.date, score: p.score }));
                        setMoodStats({ weekAvg, lastWeekAvg, spark });
                    } catch { setMoodStats({ weekAvg: 0, lastWeekAvg: 0, spark: [] }); }
                    // goals progress + YTD consistency
                    try {
                        const year = today.getFullYear();
                        const goalsArr = Array.isArray(data.goals) ? data.goals.filter((g: any) => Number(g?.year) === year) : [];
                        const yearLogs = Array.isArray(data.climbY) ? data.climbY : [];
                        const dayOfYear = Math.floor((new Date(String(data?.dates?.todayISO)).getTime() - new Date(`${year}-01-01`).getTime()) / 86400000) + 1;
                        const stats: Array<{ label: string; percent: number; onTrack: 'ahead' | 'on track' | 'behind' }> = [];
                        for (const g of goalsArr) {
                            const done = (Array.isArray(yearLogs) ? yearLogs : []).filter((x: any) => String(x?.type).toLowerCase() === String(g?.type).toLowerCase() && String(x?.grade).toLowerCase() === String(g?.grade).toLowerCase()).length;
                            const percent = g?.target ? Math.min(100, Math.round((done / Number(g.target)) * 100)) : 0;
                            const paceNeededPerDay = g?.target ? Number(g.target) / 365 : 0;
                            const actualPerDay = dayOfYear > 0 ? done / dayOfYear : 0;
                            const onTrack: 'ahead' | 'on track' | 'behind' = actualPerDay > paceNeededPerDay * 1.05 ? 'ahead' : actualPerDay >= paceNeededPerDay * 0.95 ? 'on track' : 'behind';
                            stats.push({ label: `${g.type} ${g.grade}`, percent, onTrack });
                        }
                        setGoalStats(stats);
                        // Consistency YTD
                        const timeY = Array.isArray(data.timeY) ? data.timeY : [];
                        const climbWeeks = new Set<string>(); const timeWeeks = new Set<string>();
                        const weekKey = (d: Date) => { const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = dd.getDay(); const diff = (day === 0 ? -6 : 1 - day); dd.setDate(dd.getDate() + diff); const pad2 = (n: number) => String(n).padStart(2, '0'); return `${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}-${pad2(dd.getDate())}`; };
                        for (const x of (Array.isArray(yearLogs) ? yearLogs : [])) { const d = new Date(String(x?.date).slice(0, 10)); climbWeeks.add(weekKey(d)); }
                        for (const x of (Array.isArray(timeY) ? timeY : [])) { const d = new Date(String(x?.date).slice(0, 10)); timeWeeks.add(weekKey(d)); }
                        // Streaks
                        let moodStreakDays = 0; for (let i = 0; i < 365; i++) { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; const found = (moodLast7Series || []).find((p) => String(p.date) === iso); if (found && typeof found.score === 'number') moodStreakDays += 1; else break; }
                        let climbingStreakDays = 0; for (let i = 0; i < 365; i++) { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; const items = (Array.isArray(data.climb30) ? data.climb30 : []).filter((x: any) => String(x?.date).slice(0, 10) === iso); if (Array.isArray(items) && items.length > 0) climbingStreakDays += 1; else break; }
                        setConsistency({ climbingActiveWeeksYTD: climbWeeks.size, timeActiveWeeksYTD: timeWeeks.size, moodStreakDays, climbingStreakDays });
                    } catch { setGoalStats([]); setConsistency({ climbingActiveWeeksYTD: 0, timeActiveWeeksYTD: 0, moodStreakDays: 0, climbingStreakDays: 0 }); }
                    // Weekly highlights (last 12 weeks) using YTD arrays
                    try {
                        const weekTopCategories = weekTopNamesLocal;
                        const twAgo = new Date(String(data?.dates?.twelveWeeksAgoISO));
                        const weekKey2 = (d: Date) => { const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = dd.getDay(); const diff = (day === 0 ? -6 : 1 - day); dd.setDate(dd.getDate() + diff); const pad2 = (n: number) => String(n).padStart(2, '0'); return `${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}-${pad2(dd.getDate())}`; };
                        const climbByWeek: Record<string, number> = {};
                        for (const x of (Array.isArray(data?.climbY) ? data.climbY : [])) { const d = new Date(String(x?.date).slice(0, 10)); if (d >= twAgo) { const k = weekKey2(d); climbByWeek[k] = (climbByWeek[k] || 0) + 1; } }
                        const hoursByWeek: Record<string, number> = {};
                        for (const x of (Array.isArray(data?.timeY) ? data.timeY : [])) { const d = new Date(String(x?.date).slice(0, 10)); if (d >= twAgo) { const k = weekKey2(d); hoursByWeek[k] = (hoursByWeek[k] || 0) + 1; } }
                        const bestClimbWeekCount = Object.values(climbByWeek).reduce((m, v) => Math.max(m, v), 0) || 0;
                        const bestHourWeekCount = Object.values(hoursByWeek).reduce((m, v) => Math.max(m, v), 0) || 0;
                        setWeeklyHighlights({ bestClimbWeekCount, bestHourWeekCount, topWeekCategories: weekTopCategories });
                    } catch { setWeeklyHighlights({ bestClimbWeekCount: 0, bestHourWeekCount: 0, topWeekCategories: [] }); }
                    // Weight 4w vs prev from weights8w
                    try {
                        const byW: Record<string, { sum: number; count: number }> = {};
                        const weekKey2 = (d: Date) => { const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = dd.getDay(); const diff = (day === 0 ? -6 : 1 - day); dd.setDate(dd.getDate() + diff); const pad2 = (n: number) => String(n).padStart(2, '0'); return `${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}-${pad2(dd.getDate())}`; };
                        for (const w of (cleanW || [])) { const k = weekKey2(new Date(String(w?.date))); const v = Number((w as any)?.weight); if (!Number.isFinite(v)) continue; const b = (byW[k] ||= { sum: 0, count: 0 }); b.sum += v; b.count += 1; }
                        const orderedWeeks = Object.entries(byW).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([k, v]) => ({ k, avg: v.count > 0 ? v.sum / v.count : 0 }));
                        const last4 = orderedWeeks.slice(-4); const prev4 = orderedWeeks.slice(-8, -4);
                        const ma4 = last4.length > 0 ? Number((last4.reduce((s, x) => s + x.avg, 0) / last4.length).toFixed(2)) : 0;
                        const prevMa4 = prev4.length > 0 ? Number((prev4.reduce((s, x) => s + x.avg, 0) / prev4.length).toFixed(2)) : 0;
                        const change = Number((ma4 - prevMa4).toFixed(2));
                        setWeightTrend({ ma4, prevMa4, change });
                    } catch { setWeightTrend({ ma4: 0, prevMa4: 0, change: 0 }); }
                    // Insights recalculation using aggregated data — keep existing logic below
                    // Continue to suggestions block
                }
            } catch {}
            try {
                actsCtrlRef.current = new AbortController();
                const actsRes = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { signal: actsCtrlRef.current.signal });
                const acts: Activity[] = actsRes.ok ? await actsRes.json() : [];
                allActs = Array.isArray(acts)
                    ? (acts as any[]).map((a: any) => ({
                          ...a,
                          status:
                              a?.status === 'stopped'
                                  ? 'to stop'
                                  : a?.status === 'active'
                                  ? 'to continue'
                                  : ((a?.status as Activity['status']) || 'to continue'),
                      }))
                    : [];
                currentActs = allActs.filter((a) => (a.status || 'to continue') === 'to continue');
                if (v === fetchVersionRef.current) setActivities(currentActs);
            } catch { setActivities([]); }

            // Load catalog (shared)
            try {
                catalogCtrlRef.current = new AbortController();
                const catRes = await fetch('/api/catalog', { signal: catalogCtrlRef.current.signal });
                const items: CatalogItem[] = catRes.ok ? await catRes.json() : [];
                catalogItems = Array.isArray(items) ? items : [];
                if (v === fetchVersionRef.current) setCatalog(catalogItems);
            } catch { catalogItems = []; setCatalog([]); }

            try {
                logsTodayCtrlRef.current = new AbortController();
                const logsTodayRes = await fetch(`/api/logs?date=${todayISO}&account=${encodeURIComponent(account)}`, { signal: logsTodayCtrlRef.current.signal });
                const logsToday: Log[] = logsTodayRes.ok ? await logsTodayRes.json() : [];
                logsTodayItems = Array.isArray(logsToday) ? logsToday : [];
                if (v === fetchVersionRef.current) setDoneToday((logsTodayItems || []).filter((l) => l.completed).length);
            } catch { setDoneToday(0); }

            try {
                logs7CtrlRef.current = new AbortController();
                const logs7Res = await fetch(`/api/logs?from=${from7ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: logs7CtrlRef.current.signal });
                const logs7: Log[] = logs7Res.ok ? await logs7Res.json() : [];
                logs7Items = Array.isArray(logs7) ? logs7 : [];
                if (v === fetchVersionRef.current) setLast7Done((logs7Items || []).filter((l) => l.completed).length);
            } catch { setLast7Done(0); }

            try {
                logs30CtrlRef.current = new AbortController();
                const logs30Res = await fetch(`/api/logs?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: logs30CtrlRef.current.signal });
                const logs30: Log[] = logs30Res.ok ? await logs30Res.json() : [];
                logs30Items = Array.isArray(logs30) ? logs30 : [];
                const done = (logs30Items || []).filter((l) => l.completed);
                if (v === fetchVersionRef.current) setLast30Done(done.length);
                const nameMap: Record<string, string> = Object.fromEntries((currentActs || []).map((a) => [String(a.id), a.name]));
                const byAct: Record<string, number> = {};
                for (const l of done) {
                    const key = String(l.activityId);
                    byAct[key] = (byAct[key] || 0) + 1;
                }
                const top = Object.entries(byAct)
                    .map(([id, count]) => ({ name: nameMap[id] || id, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3);
                if (v === fetchVersionRef.current) setTopActivities30(top);

                // Build recent completions (latest 5 unique by date+activity)
                const seen = new Set<string>();
                const recent: Array<{ date: string; activityId: string; name: string }> = [];
                for (const l of done
                    .slice()
                    .sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
                    const date = String(l.date);
                    const actId = String(l.activityId);
                    const k = `${date}-${actId}`;
                    if (seen.has(k)) continue;
                    seen.add(k);
                    recent.push({ date, activityId: actId, name: nameMap[actId] || actId });
                    if (recent.length >= 5) break;
                }
                if (v === fetchVersionRef.current) setRecentCompletions(recent);
            } catch { setLast30Done(0); setTopActivities30([]); setRecentCompletions([]); }

            // Weights last 30 days
            try {
                weightsCtrlRef.current = new AbortController();
                const wRes = await fetch(`/api/weights?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: weightsCtrlRef.current.signal });
                const series: WeightPoint[] = wRes.ok ? await wRes.json() : [];
                const clean = Array.isArray(series) ? series.filter((p) => Number.isFinite(p.weight)) : [];
                clean.sort((a, b) => a.date.localeCompare(b.date));
                weightSeries = clean;
                if (v === fetchVersionRef.current) setWeights30(clean);
            } catch { weightSeries = []; setWeights30([]); }

            // Highlights last 30 days
            try {
                highlightsCtrlRef.current = new AbortController();
                const hRes = await fetch(`/api/highlights?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: highlightsCtrlRef.current.signal });
                const items: Array<{ date: string; text: string }> = hRes.ok ? await hRes.json() : [];
                const clean = Array.isArray(items) ? items.filter((i) => i && i.date) : [];
                highlightsItems = clean;
                if (v === fetchVersionRef.current) setHighlights30(clean);
            } catch { highlightsItems = []; setHighlights30([]); }

            // Mood: today and last 7 avg
            try {
                moodsCtrlRef.current = new AbortController();
                const mRes = await fetch(`/api/moods?date=${todayISO}&account=${encodeURIComponent(account)}`, { signal: moodsCtrlRef.current.signal });
                const mData = mRes.ok ? await mRes.json() : null;
                const scoreToday = typeof mData?.score === 'number' ? mData.score : null;
                if (v === fetchVersionRef.current) setMoodToday(scoreToday);
            } catch { setMoodToday(null); }
            try {
                const m7Res = await fetch(`/api/moods?from=${from7ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
                const items: Array<{ date: string; score: number }> = m7Res.ok ? await m7Res.json() : [];
                const valid = items.filter((i) => typeof i?.score === 'number');
                const sorted = valid.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
                const avg = valid.length ? (valid.reduce((acc, i) => acc + (i.score || 0), 0) / valid.length) : null;
                if (v === fetchVersionRef.current) {
                    setMoodAvg7(avg !== null ? Math.round(avg * 10) / 10 : null);
                    setMood7(sorted);
                }
                moodLast7Series = sorted;
            } catch { setMoodAvg7(null); }

            try {
                metricsCtrlRef.current = new AbortController();
                const metricsRes = await fetch(`/api/metrics?account=${encodeURIComponent(account)}`, { signal: metricsCtrlRef.current.signal });
                const metrics = metricsRes.ok ? await metricsRes.json() : null;
                streakLocal = metrics?.summary?.currentStreakDays || 0;
                if (v === fetchVersionRef.current) {
                    setAvgWeeklyRate(metrics?.summary?.avgRate || 0);
                    setStreakDays(streakLocal);
                    setBestWeekLabel(metrics?.summary?.bestWeek?.week);
                    setBestWeekRate(metrics?.summary?.bestWeek?.rate || 0);
                }
                const weeks: Week[] = Array.isArray(metrics?.weeks) ? metrics.weeks : [];
                const n = weeks.length;
                if (v === fetchVersionRef.current) {
                    setThisWeekRate(n ? weeks[n - 1]?.rate || 0 : 0);
                    setLastWeekRate(n > 1 ? weeks[n - 2]?.rate || 0 : 0);
                }
            } catch { streakLocal = 0; setAvgWeeklyRate(0); setStreakDays(0); setBestWeekLabel(undefined); setBestWeekRate(0); setThisWeekRate(0); setLastWeekRate(0); }

            // Time categories and snapshots
            try {
                timeCatsCtrlRef.current = new AbortController();
                const catsRes = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`, { signal: timeCatsCtrlRef.current.signal });
                const cats = catsRes.ok ? await catsRes.json() : [];
                const catsArr = Array.isArray(cats) ? cats : [];
                if (v === fetchVersionRef.current) setTimeCategories(catsArr);
            } catch { setTimeCategories([]); }
            let timeDay: any[] = [];
            let timeWeek: any[] = [];
            try {
                timeCtrlRef.current = new AbortController();
                const dayRes = await fetch(`/api/time?date=${todayISO}&account=${encodeURIComponent(account)}`, { signal: timeCtrlRef.current.signal });
                timeDay = dayRes.ok ? await dayRes.json() : [];
                const ws = weekStartLocal(today);
                const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
                const weekFrom = toISODate(ws);
                const weekTo = toISODate(we);
                const weekRes = await fetch(`/api/time?from=${weekFrom}&to=${weekTo}&account=${encodeURIComponent(account)}`, { signal: timeCtrlRef.current.signal });
                timeWeek = weekRes.ok ? await weekRes.json() : [];
            } catch { timeDay = []; timeWeek = []; }
            try {
                const todayHours = Array.isArray(timeDay) ? timeDay.length : 0;
                const dayDist = new Map<number, number>();
                for (const e of Array.isArray(timeDay) ? timeDay : []) {
                    const c = Number(e?.category);
                    if (Number.isFinite(c)) dayDist.set(c, (dayDist.get(c) || 0) + 1);
                }
                let todayTop: { id: number; name: string; count: number; percent: number } | undefined = undefined;
                if (dayDist.size > 0 && todayHours > 0) {
                    const [topId, topCount] = Array.from(dayDist.entries()).sort((a, b) => b[1] - a[1])[0];
                    const fallbackNames: Record<number, string> = { 0:'sleep',1:'work',2:'hobbies / projects',3:'freelance',4:'exercise / sports',5:'friends',6:'relaxation and leisure',7:'wife',8:'family',9:'chores',10:'travel',11:'brain rot / misc' };
                    const cat = (Array.isArray(timeCategories) ? timeCategories : []).find((x) => String(x.id) === String(topId));
                    const name = cat?.name || fallbackNames[topId] || String(topId);
                    todayTop = { id: topId, name, count: topCount, percent: Math.round((topCount / todayHours) * 100) };
                }
                const weekTotal = Array.isArray(timeWeek) ? timeWeek.length : 0;
                const weekDist = new Map<number, number>();
                for (const e of Array.isArray(timeWeek) ? timeWeek : []) {
                    const c = Number(e?.category);
                    if (Number.isFinite(c)) weekDist.set(c, (weekDist.get(c) || 0) + 1);
                }
                const fallbackNames: Record<number, string> = { 0:'sleep',1:'work',2:'hobbies / projects',3:'freelance',4:'exercise / sports',5:'friends',6:'relaxation and leisure',7:'wife',8:'family',9:'chores',10:'travel',11:'brain rot / misc' };
                const weekTop = Array.from(weekDist.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([id, count]) => ({ id, name: ((Array.isArray(timeCategories) ? timeCategories : []).find((x) => String(x.id) === String(id))?.name) || fallbackNames[id] || String(id), count }));
                weekTopNamesLocal = weekTop.map((x) => x.name);
                if (v === fetchVersionRef.current) setTimeStats({ todayHours, todayTop, weekTotal, weekTop });
            } catch { setTimeStats({ todayHours: 0, weekTotal: 0, weekTop: [] }); }

            // Climbing snapshots
            let climbWeek: any[] = [];
            let climbPrev: any[] = [];
            let climb30: any[] = [];
            try {
                climbCtrlRef.current = new AbortController();
                const ws = weekStartLocal(today);
                const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
                const weekFrom = toISODate(ws);
                const weekTo = toISODate(we);
                const prevWs = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7);
                const prevWe = new Date(prevWs.getFullYear(), prevWs.getMonth(), prevWs.getDate() + 6);
                const prevFrom = toISODate(prevWs);
                const prevTo = toISODate(prevWe);
                const climbWeekRes = await fetch(`/api/climbing/logs?from=${weekFrom}&to=${weekTo}&account=${encodeURIComponent(account)}`, { signal: climbCtrlRef.current.signal });
                climbWeek = climbWeekRes.ok ? await climbWeekRes.json() : [];
                const climbPrevRes = await fetch(`/api/climbing/logs?from=${prevFrom}&to=${prevTo}&account=${encodeURIComponent(account)}`, { signal: climbCtrlRef.current.signal });
                climbPrev = climbPrevRes.ok ? await climbPrevRes.json() : [];
                const climb30Res = await fetch(`/api/climbing/logs?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: climbCtrlRef.current.signal });
                climb30 = climb30Res.ok ? await climb30Res.json() : [];
            } catch { climbWeek = []; climbPrev = []; climb30 = []; }
            try {
                const countSessions = (arr: any[]) => {
                    const set = new Set<string>();
                    for (const x of (Array.isArray(arr) ? arr : [])) {
                        const date = String(x?.date || '').slice(0, 10);
                        const sess = Number(x?.session) || 0;
                        if (date && sess) set.add(`${date}-${sess}`);
                    }
                    return set.size;
                };
                const sessionsThisWeek = countSessions(climbWeek);
                const sessionsLastWeek = countSessions(climbPrev);
                let flashRate30d = 0;
                let avgAttempts30d = 0;
                if (Array.isArray(climb30) && climb30.length > 0) {
                    const total = climb30.length;
                    const flashes = climb30.filter((x: any) => Number(x?.attempts) === 0).length;
                    flashRate30d = Math.round((flashes / total) * 100);
                    const attemptsList = climb30.map((x: any) => Number(x?.attempts)).filter((a) => Number.isFinite(a) && a > 0);
                    avgAttempts30d = attemptsList.length > 0 ? Number((attemptsList.reduce((s, v) => s + v, 0) / attemptsList.length).toFixed(2)) : 0;
                }
                if (v === fetchVersionRef.current) setClimbStats({ sessionsThisWeek, sessionsLastWeek, flashRate30d, avgAttempts30d });
            } catch { setClimbStats({ sessionsThisWeek: 0, sessionsLastWeek: 0, flashRate30d: 0, avgAttempts30d: 0 }); }

            // Mood overview: week vs last week + 7-day spark
            try {
                const ws = weekStartLocal(today);
                const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
                const prevWs = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7);
                const prevWe = new Date(prevWs.getFullYear(), prevWs.getMonth(), prevWs.getDate() + 6);
                const moodWeekRes = await fetch(`/api/moods?from=${toISODate(ws)}&to=${toISODate(we)}&account=${encodeURIComponent(account)}`);
                const moodPrevRes = await fetch(`/api/moods?from=${toISODate(prevWs)}&to=${toISODate(prevWe)}&account=${encodeURIComponent(account)}`);
                const moodWeek = moodWeekRes.ok ? await moodWeekRes.json() : [];
                const moodPrev = moodPrevRes.ok ? await moodPrevRes.json() : [];
                const weekAvg = Array.isArray(moodWeek) && moodWeek.length > 0 ? Number((moodWeek.reduce((s: number, x: any) => s + (Number(x?.score) || 0), 0) / moodWeek.length).toFixed(2)) : 0;
                const lastWeekAvg = Array.isArray(moodPrev) && moodPrev.length > 0 ? Number((moodPrev.reduce((s: number, x: any) => s + (Number(x?.score) || 0), 0) / moodPrev.length).toFixed(2)) : 0;
                const spark = (moodLast7Series || []).map((p) => ({ date: p.date, score: p.score }));
                if (v === fetchVersionRef.current) setMoodStats({ weekAvg, lastWeekAvg, spark });
            } catch { setMoodStats({ weekAvg: 0, lastWeekAvg: 0, spark: [] }); }

            // Goals progress (current year)
            try {
                goalsCtrlRef.current = new AbortController();
                const year = today.getFullYear();
                const goalsRes = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`, { signal: goalsCtrlRef.current.signal });
                const goals = goalsRes.ok ? await goalsRes.json() : [];
                const yearGoals = Array.isArray(goals) ? goals.filter((g: any) => Number(g?.year) === year) : [];
                const yFrom = `${year}-01-01`;
                const yTo = `${year}-12-31`;
                const yearLogsRes = await fetch(`/api/climbing/logs?from=${yFrom}&to=${yTo}&account=${encodeURIComponent(account)}`, { signal: goalsCtrlRef.current.signal });
                const yearLogs = yearLogsRes.ok ? await yearLogsRes.json() : [];
                const dayOfYear = Math.floor((new Date(toISODate(today)).getTime() - new Date(`${year}-01-01`).getTime()) / 86400000) + 1;
                const stats: Array<{ label: string; percent: number; onTrack: 'ahead' | 'on track' | 'behind' }> = [];
                for (const g of yearGoals) {
                    const done = (Array.isArray(yearLogs) ? yearLogs : []).filter((x: any) => String(x?.type).toLowerCase() === String(g?.type).toLowerCase() && String(x?.grade).toLowerCase() === String(g?.grade).toLowerCase()).length;
                    const percent = g?.target ? Math.min(100, Math.round((done / Number(g.target)) * 100)) : 0;
                    const paceNeededPerDay = g?.target ? Number(g.target) / 365 : 0;
                    const actualPerDay = dayOfYear > 0 ? done / dayOfYear : 0;
                    const onTrack: 'ahead' | 'on track' | 'behind' = actualPerDay > paceNeededPerDay * 1.05 ? 'ahead' : actualPerDay >= paceNeededPerDay * 0.95 ? 'on track' : 'behind';
                    stats.push({ label: `${g.type} ${g.grade}`, percent, onTrack });
                }
                if (v === fetchVersionRef.current) setGoalStats(stats);
            } catch { setGoalStats([]); }

            // Consistency: active weeks YTD + streaks
            try {
                const year = today.getFullYear();
                const yStart = new Date(year, 0, 1);
                const yEnd = new Date(year, 11, 31);
                const climbYRes = await fetch(`/api/climbing/logs?from=${toISODate(yStart)}&to=${toISODate(yEnd)}&account=${encodeURIComponent(account)}`);
                const climbY = climbYRes.ok ? await climbYRes.json() : [];
                const timeYRes = await fetch(`/api/time?from=${toISODate(yStart)}&to=${toISODate(yEnd)}&account=${encodeURIComponent(account)}`);
                const timeY = timeYRes.ok ? await timeYRes.json() : [];
                const climbWeeks = new Set<string>();
                for (const x of (Array.isArray(climbY) ? climbY : [])) { const d = new Date(String(x?.date).slice(0, 10)); climbWeeks.add(weekKey(d)); }
                const timeWeeks = new Set<string>();
                for (const x of (Array.isArray(timeY) ? timeY : [])) { const d = new Date(String(x?.date).slice(0, 10)); timeWeeks.add(weekKey(d)); }
                // Mood streak
                let moodStreakDays = 0;
                for (let i = 0; i < 365; i++) {
                    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
                    const res = await fetch(`/api/moods?date=${toISODate(d)}&account=${encodeURIComponent(account)}`);
                    const data = res.ok ? await res.json() : { score: null };
                    if (typeof data?.score === 'number') moodStreakDays += 1; else break;
                }
                // Climbing streak
                let climbingStreakDays = 0;
                for (let i = 0; i < 365; i++) {
                    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
                    const res = await fetch(`/api/climbing/logs?date=${toISODate(d)}&account=${encodeURIComponent(account)}`);
                    const items = res.ok ? await res.json() : [];
                    if (Array.isArray(items) && items.length > 0) climbingStreakDays += 1; else break;
                }
                if (v === fetchVersionRef.current) setConsistency({ climbingActiveWeeksYTD: climbWeeks.size, timeActiveWeeksYTD: timeWeeks.size, moodStreakDays, climbingStreakDays });
            } catch { setConsistency({ climbingActiveWeeksYTD: 0, timeActiveWeeksYTD: 0, moodStreakDays: 0, climbingStreakDays: 0 }); }

            // Weekly highlights and time balance
            try {
                const restNames = new Set(['sleep', 'relaxation and leisure', 'friends', 'family', 'wife', 'travel', 'brain rot / misc']);
                const productiveNames = new Set(['work', 'hobbies / projects', 'freelance', 'exercise / sports', 'chores']);
                const catNameById = new Map<number, string>();
                for (const c of timeCategories) { const idNum = Number(c.id); if (Number.isFinite(idNum)) catNameById.set(idNum, c.name.toLowerCase()); }
                const productiveIds = new Set([1,2,3,4,9]);
                const restIds = new Set([0,5,6,7,8,10,11]);
                const classify = (catId: number) => {
                    const name = (catNameById.get(catId) || '').toLowerCase();
                    if (restNames.has(name) || restIds.has(catId)) return 'rest';
                    if (productiveNames.has(name) || productiveIds.has(catId)) return 'productive';
                    return 'other';
                };
                let todayProductive = 0, todayRest = 0, sleepToday = 0;
                for (const e of Array.isArray(timeDay) ? timeDay : []) {
                    const cid = Number(e?.category);
                    const cls = classify(cid);
                    if (cls === 'productive') todayProductive += 1; else if (cls === 'rest') todayRest += 1;
                    if ((catNameById.get(cid) || '') === 'sleep' || cid === 0) sleepToday += 1;
                }
                let weekProductive = 0, weekRest = 0;
                for (const e of Array.isArray(timeWeek) ? timeWeek : []) {
                    const cid = Number(e?.category);
                    const cls = classify(cid);
                    if (cls === 'productive') weekProductive += 1; else if (cls === 'rest') weekRest += 1;
                }
                if (v === fetchVersionRef.current) setBalanceStats({ todayProductive, todayRest, weekProductive, weekRest, sleepToday });

                const ws = weekStartLocal(today);
                const weekTo = toISODate(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6));
                const twelveAgo = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * 12);
                const logs12Res = await fetch(`/api/climbing/logs?from=${toISODate(twelveAgo)}&to=${weekTo}&account=${encodeURIComponent(account)}`);
                const logs12 = logs12Res.ok ? await logs12Res.json() : [];
                const time12Res = await fetch(`/api/time?from=${toISODate(twelveAgo)}&to=${weekTo}&account=${encodeURIComponent(account)}`);
                const time12 = time12Res.ok ? await time12Res.json() : [];
                const climbByWeek: Record<string, number> = {};
                for (const x of (Array.isArray(logs12) ? logs12 : [])) { const k = weekKey(new Date(String(x?.date).slice(0, 10))); climbByWeek[k] = (climbByWeek[k] || 0) + 1; }
                const hoursByWeek: Record<string, number> = {};
                for (const x of (Array.isArray(time12) ? time12 : [])) { const k = weekKey(new Date(String(x?.date).slice(0, 10))); hoursByWeek[k] = (hoursByWeek[k] || 0) + 1; }
                const bestClimbWeekCount = Object.values(climbByWeek).reduce((m, v) => Math.max(m, v), 0) || 0;
                const bestHourWeekCount = Object.values(hoursByWeek).reduce((m, v) => Math.max(m, v), 0) || 0;
                const topWeekCategories = weekTopNamesLocal;
                if (v === fetchVersionRef.current) setWeeklyHighlights({ bestClimbWeekCount, bestHourWeekCount, topWeekCategories });
            } catch { setBalanceStats({ todayProductive: 0, todayRest: 0, weekProductive: 0, weekRest: 0, sleepToday: 0 }); setWeeklyHighlights({ bestClimbWeekCount: 0, bestHourWeekCount: 0, topWeekCategories: [] }); }

            // Weight trend: 4-week MA vs previous
            try {
                extraWeightsCtrlRef.current = new AbortController();
                const ws = weekStartLocal(today);
                const weekTo = toISODate(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6));
                const eightWeeksAgo = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * 8);
                const wRes = await fetch(`/api/weights?from=${toISODate(eightWeeksAgo)}&to=${weekTo}&account=${encodeURIComponent(account)}`, { signal: extraWeightsCtrlRef.current.signal });
                const weights = wRes.ok ? await wRes.json() : [];
                const byW: Record<string, { sum: number; count: number }> = {};
                for (const w of (Array.isArray(weights) ? weights : [])) {
                    const k = weekKey(new Date(String(w?.date).slice(0, 10)));
                    const v = Number(w?.weight);
                    if (!Number.isFinite(v)) continue;
                    const b = (byW[k] ||= { sum: 0, count: 0 });
                    b.sum += v; b.count += 1;
                }
                const orderedWeeks = Object.entries(byW).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([k, v]) => ({ k, avg: v.count > 0 ? v.sum / v.count : 0 }));
                const last4 = orderedWeeks.slice(-4);
                const prev4 = orderedWeeks.slice(-8, -4);
                const ma4 = last4.length > 0 ? Number((last4.reduce((s, x) => s + x.avg, 0) / last4.length).toFixed(2)) : 0;
                const prevMa4 = prev4.length > 0 ? Number((prev4.reduce((s, x) => s + x.avg, 0) / prev4.length).toFixed(2)) : 0;
                const change = Number((ma4 - prevMa4).toFixed(2));
                if (v === fetchVersionRef.current) setWeightTrend({ ma4, prevMa4, change });
            } catch { setWeightTrend({ ma4: 0, prevMa4: 0, change: 0 }); }

            // Compute insights after data loaded
            try {
                if (v === fetchVersionRef.current) {
                    const suggestions: string[] = [];
                    const actNameMap: Record<string, string> = Object.fromEntries((allActs || []).map((a) => [String(a.id), a.name]));
                    const doneByDay: Record<string, Set<string>> = {};
                    // Build per-day activity set from last 30 logs
                    // We re-fetch logs30 in scope; alternatively reuse done above
                    // Use recentCompletions and activities to estimate frequency
                    // Simple frequency by name over 7 and 30 days
                    // Identify common activities
                    const common = ['coffee', 'gym', 'creatine', 'vitamin', 'vitamins'];
                    const catalogById: Record<string, CatalogItem> = Object.fromEntries((catalogItems || []).map((c) => [c.id, c]));
                    const nameLowerMap: Record<string, string> = {};
                    for (const a of allActs) nameLowerMap[a.id] = a.name.toLowerCase();

                    // Build per-day sets from local logs30Items
                    for (const l of logs30Items.filter((x) => x.completed)) {
                        const day = String(l.date);
                        const set = (doneByDay[day] ||= new Set<string>());
                        set.add(String(l.activityId));
                    }

                    const last7Days: string[] = []; {
                        const d = new Date(today);
                        for (let i = 6; i >= 0; i--) {
                            const dd = new Date(d);
                            dd.setDate(dd.getDate() - i);
                            last7Days.push(localISO(dd));
                        }
                    }
                    const prev7Days: string[] = []; {
                        const d = new Date(today);
                        for (let i = 13; i >= 7; i--) {
                            const dd = new Date(d);
                            dd.setDate(dd.getDate() - i);
                            prev7Days.push(localISO(dd));
                        }
                    }

                    const freq7: Record<string, number> = {};
                    const freq30: Record<string, number> = {};
                    const freqPrev7: Record<string, number> = {};
                    for (const [day, set] of Object.entries(doneByDay)) {
                        for (const id of set) {
                            freq30[id] = (freq30[id] || 0) + 1;
                            if (last7Days.includes(day)) freq7[id] = (freq7[id] || 0) + 1;
                            if (prev7Days.includes(day)) freqPrev7[id] = (freqPrev7[id] || 0) + 1;
                        }
                    }

                    // Weight trend
                    let weightTrend = 0;
                    if (weightSeries.length >= 2) {
                        const w0 = weightSeries[0].weight;
                        const wN = weightSeries[weightSeries.length - 1].weight;
                        weightTrend = wN - w0;
                        const changeStr = `${weightTrend >= 0 ? '+' : ''}${Math.round(weightTrend * 10) / 10} kg in 30 days`;
                        suggestions.push(`Weight change: ${changeStr}`);
                    }

                    // Compute category frequencies
                    const norm = (s: string) => s.trim().toLowerCase();
                    const idsForCategory = (cat: string) => {
                        const target = norm(cat);
                        return allActs.filter((a) => a.catalogId && norm(catalogById[a.catalogId]?.category || '') === target).map((a) => a.id);
                    };
                    // Build category keywords dynamically from Catalog sheet tags
                    const categoryKeywords: Record<string, string[]> = (() => {
                        const map: Record<string, string[]> = {};
                        for (const item of catalog || []) {
                            const catKey = norm(item.category || '');
                            if (!catKey) continue;
                            const tagsArr = (item.tags || '')
                                .split(',')
                                .map((t) => norm(t))
                                .filter(Boolean);
                            const nameKw = norm(item.name || '');
                            if (!map[catKey]) map[catKey] = [];
                            map[catKey].push(...tagsArr);
                            if (nameKw) map[catKey].push(nameKw);
                        }
                        // Add sensible defaults per category to avoid zeros if Catalog lacks tags
                        const addDefaults = (key: string, defaults: string[]) => {
                            const cur = map[key] || [];
                            const next = cur.length ? Array.from(new Set([...cur, ...defaults.map(norm)])) : defaults.map(norm);
                            map[key] = next;
                        };
                        addDefaults('exercise', ['gym', 'run', 'walk', 'swim', 'bike', 'yoga', 'pilates', 'workout', 'training', 'climb', 'squash']);
                        addDefaults('caffeine', ['coffee', 'espresso', 'latte', 'caffeine', 'tea']);
                        addDefaults('supplements', ['creatine', 'protein', 'vitamin', 'supplement', 'omega', 'fish oil', 'multivitamin']);
                        addDefaults('alcohol', ['alcohol', 'beer', 'wine', 'cocktail', 'drinks']);
                        addDefaults('leisure', ['video games', 'gaming', 'ps5', 'xbox', 'steam', 'switch', 'game']);
                        addDefaults('content', ['post', 'story', 'reel', 'video', 'content', 'upload']);
                        addDefaults('habit', ['sleep late', 'sleep early', 'sleep', 'late']);
                        for (const k of Object.keys(map)) {
                            map[k] = Array.from(new Set(map[k]));
                        }
                        return map;
                    })();
                    const idsForKeywords = (cat: string) => {
                        const kws = categoryKeywords[norm(cat)] || [];
                        return allActs
                            .filter((a) => {
                                const nm = nameLowerMap[a.id] || '';
                                return kws.some((kw) => nm.includes(kw));
                            })
                            .map((a) => a.id);
                    };
                    const gymIds = idsForCategory('exercise');
                    const coffeeIds = idsForCategory('caffeine');
                    const suppIds = idsForCategory('supplements');
                    const contentIds = idsForCategory('content');
                    const alcoholIds = idsForCategory('alcohol');
                    const vgIds = idsForCategory('leisure');

                    // Fallback if catalog categories are empty: use name-based IDs
                    const unique = (arr: string[]) => Array.from(new Set(arr));
                    const withKeywords = (catIds: string[], catName: string) => unique([...catIds, ...idsForKeywords(catName)]);
                    const gymIdsFinal = withKeywords(gymIds, 'exercise');
                    const coffeeIdsFinal = withKeywords(coffeeIds, 'caffeine');
                    const suppIdsFinal = withKeywords(suppIds, 'supplements');
                    const contentIdsFinal = withKeywords(contentIds, 'content');
                    const alcoholIdsFinal = withKeywords(alcoholIds, 'alcohol');
                    const vgIdsFinal = withKeywords(vgIds, 'leisure');
                    const habitIds = idsForCategory('habit');
                    const habitIdsFinal = withKeywords(habitIds, 'habit');

                    // Stop targets: activities to reduce (by tags or category: caffeine, alcohol, leisure)
                    // Stop targets purely by status: activities with status "to stop"
                    const stopIdsFinal = allActs
                        .filter((a) => (a.status || 'to continue') === 'to stop')
                        .map((a) => a.id);

                    // Exclude stop-target activities from "positive" activity list (expected ticks)
                    if (v === fetchVersionRef.current) {
                        const filteredActs = currentActs.filter((a) => !stopIdsFinal.includes(a.id));
                        setActivities(filteredActs);
                    }

                    // Counts using final ID sets
                    // Per-activity frequency (days per activity in last 7)
                    const countForIds = (ids: string[]) => ids.reduce((acc, id) => acc + (freq7[id] || 0), 0);
                    // Per-category day count (unique days with any matching activity)
                    const daysCountForIds = (ids: string[]) => {
                        const idsSet = new Set(ids);
                        let days = 0;
                        for (const day of last7Days) {
                            const set = doneByDay[day];
                            if (set && Array.from(set).some((id) => idsSet.has(id))) days += 1;
                        }
                        return days;
                    };
                    const daysCountForIdsInSet = (ids: string[], days: string[]) => {
                        const idsSet = new Set(ids);
                        let cnt = 0;
                        for (const day of days) {
                            const set = doneByDay[day];
                            if (set && Array.from(set).some((id) => idsSet.has(id))) cnt += 1;
                        }
                        return cnt;
                    };
                    // Consider only "to continue" activities for positive metrics
                    const continueIdsAll = allActs.filter((a) => (a.status || 'to continue') === 'to continue').map((a) => a.id);
                    const continueSet = new Set(continueIdsAll);
                    const onlyContinue = (ids: string[]) => ids.filter((id) => continueSet.has(id));

                    const gymDays7 = daysCountForIds(onlyContinue(gymIdsFinal));
                    const coffeeDays7 = daysCountForIds(onlyContinue(coffeeIdsFinal));
                    const supp7 = countForIds(onlyContinue(suppIdsFinal));
                    let contentDays7 = daysCountForIds(onlyContinue(contentIdsFinal));
                    const alcoholDays7 = daysCountForIds(onlyContinue(alcoholIdsFinal));
                    const vgDays7 = daysCountForIds(onlyContinue(vgIdsFinal));
                    const habitDays7 = daysCountForIds(onlyContinue(habitIdsFinal));
                    const stopDays7 = daysCountForIds(stopIdsFinal);
                    const stopDaysPrev7 = daysCountForIdsInSet(stopIdsFinal, prev7Days);
                    const adherence = suppIdsFinal.length ? Math.round((supp7 / (7 * suppIdsFinal.length)) * 100) : 0;

                    // Recompute today/7d/30d positive completion counts excluding stop targets
                    const stopSet = new Set(stopIdsFinal.map(String));
                    const doneTodayPos = (logsTodayItems || []).filter((l) => l.completed && !stopSet.has(String(l.activityId))).length;
                    const done7Pos = (logs7Items || []).filter((l) => l.completed && !stopSet.has(String(l.activityId))).length;
                    const done30Pos = (logs30Items || []).filter((l) => l.completed && !stopSet.has(String(l.activityId))).length;
                    setDoneToday(doneTodayPos);
                    setLast7Done(done7Pos);
                    setLast30Done(done30Pos);

                    // Count of logs for to-stop activities in last 7 (for summary tile)
                    const toStopCount = Object.entries(freq7).reduce((acc, [id, c]) => acc + (stopSet.has(id) ? (c || 0) : 0), 0);

                    // Recompute Top Activities (30d) and Recent Completions excluding stop targets
                    const nameMapFiltered: Record<string, string> = Object.fromEntries((currentActs || []).map((a) => [String(a.id), a.name]));
                    const doneFiltered = (logs30Items || []).filter((l) => l.completed && !stopSet.has(String(l.activityId)));
                    const byActFiltered: Record<string, number> = {};
                    for (const l of doneFiltered) {
                        const key = String(l.activityId);
                        byActFiltered[key] = (byActFiltered[key] || 0) + 1;
                    }
                    const topFiltered = Object.entries(byActFiltered)
                        .map(([id, count]) => ({ name: nameMapFiltered[id] || id, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3);
                    setTopActivities30(topFiltered);

                    const seenFiltered = new Set<string>();
                    const recentFiltered: Array<{ date: string; activityId: string; name: string }> = [];
                    for (const l of doneFiltered
                        .slice()
                        .sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
                        const date = String(l.date);
                        const actId = String(l.activityId);
                        const k = `${date}-${actId}`;
                        if (seenFiltered.has(k)) continue;
                        seenFiltered.add(k);
                        recentFiltered.push({ date, activityId: actId, name: nameMapFiltered[actId] || actId });
                        if (recentFiltered.length >= 5) break;
                    }
                    setRecentCompletions(recentFiltered);

                    // Also infer content posts from highlights text in last 7 days
                    const last7Set = new Set(last7Days);
                    const contentKWs = categoryKeywords['content'] || [];
                    const content7FromHighlights = highlightsItems
                        .filter((h) => last7Set.has(String(h.date)))
                        .reduce((acc, h) => {
                            const txt = norm(h.text || '');
                            return acc + (contentKWs.some((kw) => txt.includes(kw)) ? 1 : 0);
                        }, 0);
                    const content7 = Math.max(contentDays7, content7FromHighlights);

                    // Suggestions based on categories
                    if (gymIdsFinal.length) {
                        suggestions.push(`Exercise days: ${gymDays7}/7`);
                        if (gymDays7 <= 2) suggestions.push(`Try more exercise this week (≤2/7).`);
                    }
                    if (coffeeIdsFinal.length) {
                        suggestions.push(`Caffeine days: ${coffeeDays7}/7`);
                        if (coffeeDays7 >= 6) suggestions.push(`Caffeine is high (≥6/7). Try cutting back.`);
                    }
                    if (suppIdsFinal.length) {
                        suggestions.push(`Supplements adherence: ${adherence}% (7 days)`);
                        if (adherence < 60) suggestions.push(`Adherence is low (<60%). Set a daily reminder.`);
                    }
                    if (alcoholIdsFinal.length) {
                        suggestions.push(`Alcohol days: ${alcoholDays7}/7`);
                        if (alcoholDays7 >= 3) suggestions.push(`Alcohol is frequent (≥3/7). Consider reducing.`);
                        if (weightTrend > 0 && alcoholDays7 >= 2) suggestions.push(`Weight is rising with alcohol (≥2/7). Try less.`);
                    }
                    if (vgIdsFinal.length && vgDays7 >= 5) {
                        suggestions.push(`Leisure is high (≥5/7). Try a digital detox day.`);
                    }
                    suggestions.push(`Content posts: ${content7}/7`);
                    if (contentIdsFinal.length && content7 < 3) suggestions.push(`Plan at least 3 posts next week.`);

                    // Sleep Late / Habit insights (stop-oriented)
                    const sleepLateIds = stopIdsFinal.filter((id) => (nameLowerMap[id] || '').includes('sleep late'));
                    const sleepLate7 = daysCountForIds(sleepLateIds);
                    if (sleepLateIds.length) {
                        suggestions.push(`Sleep late nights: ${sleepLate7}/7`);
                        if (sleepLate7 >= 3) suggestions.push(`Aim for ≤2 late nights next week.`);
                    } else if (habitIdsFinal.length) {
                        suggestions.push(`Habit days: ${habitDays7}/7`);
                    }

                    // Build explicit activity status lists: To Stop vs To Continue
                    const toStopList = stopIdsFinal
                        .map((id) => ({ name: actNameMap[id] || id, count: freq7[id] || 0, prev: freqPrev7[id] || 0 }))
                        .sort((a, b) => b.count - a.count);
                    const continueIds = allActs
                        .filter((a) => (a.status || 'to continue') === 'to continue' && !stopIdsFinal.includes(a.id))
                        .map((a) => a.id);
                    const toContinueList = continueIds
                        .map((id) => ({ name: actNameMap[id] || id, count: freq7[id] || 0 }))
                        .sort((a, b) => b.count - a.count);
                    setToStopActs(toStopList);
                    setToContinueActs(toContinueList);

                    // Highlight engagement
                    const highlightDays = highlightsItems.length;
                    suggestions.push(`Highlights logged: ${highlightDays}/30`);
                    if (highlightDays < 10) suggestions.push(`Try logging more highlights (<10/30).`);

                    // Low-activity focus (last 7)
                    const lowActs = continueIdsAll
                        .map((id) => ({ id, count: freq7[id] || 0, name: actNameMap[id] || id }))
                        .sort((a, b) => a.count - b.count)
                        .slice(0, 3);
                    for (const la of lowActs) {
                        suggestions.push(`${la.name}: ${la.count}/7 (low). Add a session.`);
                    }

                    // Removed "Stopped habits" logic; use explicit To Stop list above

                    // Next 7-day plan (simple forecast)
                    if (gymIdsFinal.length && gymDays7 < 3) suggestions.push(`Plan: 3 exercise days next week.`);
                    if (coffeeIdsFinal.length && coffeeDays7 > 4) suggestions.push(`Plan: caffeine ≤4 days.`);
                    if (suppIdsFinal.length && adherence < 80) suggestions.push(`Plan: take supplements daily (7/7).`);
                    if (contentIdsFinal.length && content7 < 3) suggestions.push(`Plan: ≥3 posts next week.`);

                    // Positive reinforcement / simple correlations
                    if (gymDays7 >= 4 && weightTrend <= 0) suggestions.push(`Great job: exercise ≥4/7 and weight ${weightTrend <= 0 ? 'stable/down' : 'stable'}.`);
                    if (coffeeDays7 >= 6 && streakLocal < 3) suggestions.push(`Caffeine ≥6/7 with low streak — try an earlier cut-off.`);

                    // Update summary cards
                    setSummary7({ exercise: gymDays7, caffeine: coffeeDays7, supplements: adherence, alcohol: alcoholDays7, leisure: vgDays7, content: content7, stopped: toStopCount });

                    setInsights(suggestions);
                }
            } catch { }
        }
        if (account) load();
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
            {/* Ordered groups for clear top-to-bottom reading on mobile */}
            <h3 className="text-base font-semibold">Mood & Weight</h3>
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
                </div>
                {/* Mood Overview supplemental */}
                <div className="card p-4">
                    <div className="card-title">Mood Overview</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>Avg this week: {moodStats.weekAvg}</li>
                        <li>Avg last week: {moodStats.lastWeekAvg}</li>
                        <li className="flex items-center gap-1">7-day spark: {moodStats.spark.map((s) => (
                            <span key={s.date} className="inline-block w-2 h-4" title={`${s.date}: ${s.score ?? '—'}`} style={{ background: typeof s.score === 'number' ? `hsl(${(s.score / 10) * 120},70%,50%)` : 'var(--muted)' }} />
                        ))}</li>
                    </ul>
                </div>
                {/* Weight Trend with chart (30d) */}
                <div className="card p-4">
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
                    <div className="card-title">Recent Completions</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {recentCompletions.length ? recentCompletions.map((r) => (
                            <li key={`${r.date}-${r.activityId}`} className="flex justify-between">
                                <span className="truncate max-w-[60%]" title={r.name}>{r.name}</span>
                                <span className="muted">{r.date}</span>
                            </li>
                        )) : <li className="muted">No recent activity</li>}
                    </ul>
                </div>
                <div>
                    <div className="card-title">Category Summary (7d)</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="card p-3">
                            <div className="subtle">Exercise Days</div>
                            <div className="text-lg font-semibold">{summary7.exercise}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Caffeine Days</div>
                            <div className="text-lg font-semibold">{summary7.caffeine}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Supplements Adherence</div>
                            <div className="text-lg font-semibold">{summary7.supplements}%</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Alcohol Days</div>
                            <div className="text-lg font-semibold">{summary7.alcohol}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Leisure Days</div>
                            <div className="text-lg font-semibold">{summary7.leisure}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">Content Posts</div>
                            <div className="text-lg font-semibold">{summary7.content}</div>
                        </div>
                        <div className="card p-3">
                            <div className="subtle">To Stop Logs</div>
                            <div className="text-lg font-semibold">{summary7.stopped}</div>
                        </div>
                    </div>
                    {summary7.stopped > 0 && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">To-stop logs: {summary7.stopped} in last 7 days</div>
                    )}
                </div>
                <div>
                    <div className="card-title">Top Activities (30d)</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {topActivities30.length ? topActivities30.map((t) => (
                            <li key={t.name} className="flex justify-between">
                                <span>{t.name}</span>
                                <span className="muted">{t.count}</span>
                            </li>
                        )) : <li className="muted">No recent completions</li>}
                    </ul>
                </div>
                <div>
                    <div className="card-title">Statuses (7d)</div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="subtle mb-1">To Continue</div>
                            <ul className="space-y-1 text-sm">
                                {toContinueActs.length ? toContinueActs.map((s) => (
                                    <li key={s.name} className="flex justify-between">
                                        <span className="truncate max-w-[60%]" title={s.name}>{s.name}</span>
                                        <span className="muted">{s.count}</span>
                                    </li>
                                )) : <li className="muted">No activities marked to continue</li>}
                            </ul>
                        </div>
                        <div>
                            <div className="subtle mb-1">To Stop</div>
                            <ul className="space-y-1 text-sm">
                                {toStopActs.length ? toStopActs.map((s) => (
                                    <li key={s.name} className="flex justify-between">
                                        <span className="truncate max-w-[60%]" title={s.name}>{s.name}</span>
                                        <span className="muted">{s.count} (prev {s.prev})</span>
                                    </li>
                                )) : <li className="muted">No activities marked to stop</li>}
                            </ul>
                        </div>
                    </div>
                </div>
                <div>
                    <div className="card-title">Insights & Suggestions</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {insights.length ? insights.map((s, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span>•</span><span>{s}</span>
                            </li>
                        )) : <li className="muted">No insights yet</li>}
                    </ul>
                </div>
            </div>

            
            
        </main>
    );
}
