"use client";

import type { Activity, CatalogItem, Log, Week, WeightPoint } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Dashboard() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromISO = `${y}-${pad(m)}-01`;
    const toISO = `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayISO = today.toISOString().slice(0, 10);
    const d7 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d7.setUTCDate(d7.getUTCDate() - 6);
    const from7ISO = d7.toISOString().slice(0, 10);
    const d30 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d30.setUTCDate(d30.getUTCDate() - 29);
    const from30ISO = d30.toISOString().slice(0, 10);

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
    const fetchVersionRef = useRef(0);
    const actsCtrlRef = useRef<AbortController | null>(null);
    const catalogCtrlRef = useRef<AbortController | null>(null);
    const logsTodayCtrlRef = useRef<AbortController | null>(null);
    const logs7CtrlRef = useRef<AbortController | null>(null);
    const logs30CtrlRef = useRef<AbortController | null>(null);
    const metricsCtrlRef = useRef<AbortController | null>(null);
    const weightsCtrlRef = useRef<AbortController | null>(null);
    const highlightsCtrlRef = useRef<AbortController | null>(null);

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
            try {
                actsCtrlRef.current = new AbortController();
                const actsRes = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { signal: actsCtrlRef.current.signal });
                const acts: Activity[] = actsRes.ok ? await actsRes.json() : [];
                allActs = Array.isArray(acts) ? acts : [];
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
                        const d = new Date(todayISO);
                        for (let i = 6; i >= 0; i--) {
                            const dd = new Date(d);
                            dd.setUTCDate(dd.getUTCDate() - i);
                            last7Days.push(dd.toISOString().slice(0, 10));
                        }
                    }
                    const prev7Days: string[] = []; {
                        const d = new Date(todayISO);
                        for (let i = 13; i >= 7; i--) {
                            const dd = new Date(d);
                            dd.setUTCDate(dd.getUTCDate() - i);
                            prev7Days.push(dd.toISOString().slice(0, 10));
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Activities</div>
                    <div className="text-2xl font-semibold">{activities.length}</div>
                </div>
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Today</div>
                    <div className="text-2xl font-semibold">{doneToday}/{activities.length} done</div>
                    <div className="text-xs text-neutral-500">Streak: {streakDays} days</div>
                </div>
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Recent Completions</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {recentCompletions.length ? recentCompletions.map((r) => (
                            <li key={`${r.date}-${r.activityId}`} className="flex justify-between">
                                <span className="truncate max-w-[60%]" title={r.name}>{r.name}</span>
                                <span className="text-neutral-500">{r.date}</span>
                            </li>
                        )) : <li className="text-neutral-500">No recent activity</li>}
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Last 7 Days</div>
                    <div className="text-2xl font-semibold">{last7Expected ? Math.round((last7Done / last7Expected) * 100) : 0}%</div>
                    <div className="text-xs text-neutral-500">{last7Done}/{last7Expected} completions</div>
                </div>
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Avg Weekly Rate</div>
                    <div className="text-2xl font-semibold">{Math.round(avgWeeklyRate * 100)}%</div>
                    <div className="text-xs text-neutral-500">Best: {bestWeekLabel ? `${Math.round(bestWeekRate * 100)}% (${bestWeekLabel})` : '-'}</div>
                </div>
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">This vs Last Week</div>
                    <div className="text-2xl font-semibold">{Math.round(thisWeekRate * 100)}% / {Math.round(lastWeekRate * 100)}%</div>
                    <div className="text-xs text-neutral-500">current / previous</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Last 30 Days</div>
                    <div className="text-2xl font-semibold">{last30Done}</div>
                    <div className="text-xs text-neutral-500">total completions</div>
                </div>
                <div className="rounded border p-4">
                    <div className="text-sm text-neutral-500">Weight Trend (30d)</div>
                    <div className="text-2xl font-semibold">{weights30.length >= 2 ? `${(Math.round((weights30[weights30.length - 1].weight - weights30[0].weight) * 10) / 10)} kg` : '-'}</div>
                    <div className="text-xs text-neutral-500">latest - earliest</div>
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
                <div className="rounded border p-4 sm:col-span-2">
                    <div className="text-sm text-neutral-500">Category Summary (7d)</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">Exercise Days</div>
                            <div className="text-lg font-semibold">{summary7.exercise}</div>
                        </div>
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">Caffeine Days</div>
                            <div className="text-lg font-semibold">{summary7.caffeine}</div>
                        </div>
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">Supplements Adherence</div>
                            <div className="text-lg font-semibold">{summary7.supplements}%</div>
                        </div>
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">Alcohol Days</div>
                            <div className="text-lg font-semibold">{summary7.alcohol}</div>
                        </div>
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">Leisure Days</div>
                            <div className="text-lg font-semibold">{summary7.leisure}</div>
                        </div>
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">Content Posts</div>
                            <div className="text-lg font-semibold">{summary7.content}</div>
                        </div>
                        <div className="rounded border p-3">
                            <div className="text-xs text-neutral-500">To Stop Logs</div>
                            <div className="text-lg font-semibold">{summary7.stopped}</div>
                        </div>
                    </div>
                    {summary7.stopped > 0 && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">To-stop logs: {summary7.stopped} in last 7 days</div>
                    )}
                </div>
                <div className="rounded border p-4 sm:col-span-2">
                    <div className="text-sm text-neutral-500">Top Activities (30d)</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {topActivities30.length ? topActivities30.map((t) => (
                            <li key={t.name} className="flex justify-between">
                                <span>{t.name}</span>
                                <span className="text-neutral-500">{t.count}</span>
                            </li>
                        )) : <li className="text-neutral-500">No recent completions</li>}
                    </ul>
                </div>
                <div className="rounded border p-4 sm:col-span-2">
                    <div className="text-sm text-neutral-500">To Stop (7d)</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {toStopActs.length ? toStopActs.map((s) => (
                            <li key={s.name} className="flex justify-between">
                                <span className="truncate max-w-[60%]" title={s.name}>{s.name}</span>
                                <span className="text-neutral-500">{s.count} (prev {s.prev})</span>
                            </li>
                        )) : <li className="text-neutral-500">No activities marked to stop</li>}
                    </ul>
                </div>
                <div className="rounded border p-4 sm:col-span-2">
                    <div className="text-sm text-neutral-500">To Continue (7d)</div>
                    <ul className="mt-2 space-y-1 text-sm">
                        {toContinueActs.length ? toContinueActs.map((s) => (
                            <li key={s.name} className="flex justify-between">
                                <span className="truncate max-w-[60%]" title={s.name}>{s.name}</span>
                                <span className="text-neutral-500">{s.count}</span>
                            </li>
                        )) : <li className="text-neutral-500">No activities marked to continue</li>}
                    </ul>
                </div>
                {/* Removed Stopped Habits card: statuses use To Stop / To Continue */}
            </div>

            <div className="rounded border p-4">
                <div className="text-sm text-neutral-500">Insights & Suggestions</div>
                <ul className="mt-2 space-y-1 text-sm">
                    {insights.length ? insights.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span>•</span><span>{s}</span>
                        </li>
                    )) : <li className="text-neutral-500">No insights yet</li>}
                </ul>
            </div>
        </main>
    );
}
