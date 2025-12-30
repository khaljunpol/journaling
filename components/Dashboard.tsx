"use client";

import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SUGGESTED_ACTIVITIES } from '@/lib/activityCatalog';

type Activity = { id: string; name: string };
type Log = { date: string; activityId: string; completed: boolean };
type Week = { week: string; rate: number };
type WeightPoint = { date: string; weight: number };

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
    const fetchVersionRef = useRef(0);
    const actsCtrlRef = useRef<AbortController | null>(null);
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
            try {
                actsCtrlRef.current = new AbortController();
                const actsRes = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { signal: actsCtrlRef.current.signal });
                const acts: Activity[] = actsRes.ok ? await actsRes.json() : [];
                currentActs = Array.isArray(acts) ? acts : [];
                if (v === fetchVersionRef.current) setActivities(currentActs);
            } catch { setActivities([]); }

            try {
                logsTodayCtrlRef.current = new AbortController();
                const logsTodayRes = await fetch(`/api/logs?date=${todayISO}&account=${encodeURIComponent(account)}`, { signal: logsTodayCtrlRef.current.signal });
                const logsToday: Log[] = logsTodayRes.ok ? await logsTodayRes.json() : [];
                if (v === fetchVersionRef.current) setDoneToday((logsToday || []).filter((l) => l.completed).length);
            } catch { setDoneToday(0); }

            try {
                logs7CtrlRef.current = new AbortController();
                const logs7Res = await fetch(`/api/logs?from=${from7ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: logs7CtrlRef.current.signal });
                const logs7: Log[] = logs7Res.ok ? await logs7Res.json() : [];
                if (v === fetchVersionRef.current) setLast7Done((logs7 || []).filter((l) => l.completed).length);
            } catch { setLast7Done(0); }

            try {
                logs30CtrlRef.current = new AbortController();
                const logs30Res = await fetch(`/api/logs?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: logs30CtrlRef.current.signal });
                const logs30: Log[] = logs30Res.ok ? await logs30Res.json() : [];
                const done = (logs30 || []).filter((l) => l.completed);
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
                if (v === fetchVersionRef.current) setWeights30(clean);
            } catch { setWeights30([]); }

            // Highlights last 30 days
            try {
                highlightsCtrlRef.current = new AbortController();
                const hRes = await fetch(`/api/highlights?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`, { signal: highlightsCtrlRef.current.signal });
                const items: Array<{ date: string; text: string }> = hRes.ok ? await hRes.json() : [];
                const clean = Array.isArray(items) ? items.filter((i) => i && i.date) : [];
                if (v === fetchVersionRef.current) setHighlights30(clean);
            } catch { setHighlights30([]); }

            try {
                metricsCtrlRef.current = new AbortController();
                const metricsRes = await fetch(`/api/metrics?account=${encodeURIComponent(account)}`, { signal: metricsCtrlRef.current.signal });
                const metrics = metricsRes.ok ? await metricsRes.json() : null;
                if (v === fetchVersionRef.current) {
                    setAvgWeeklyRate(metrics?.summary?.avgRate || 0);
                    setStreakDays(metrics?.summary?.currentStreakDays || 0);
                    setBestWeekLabel(metrics?.summary?.bestWeek?.week);
                    setBestWeekRate(metrics?.summary?.bestWeek?.rate || 0);
                }
                const weeks: Week[] = Array.isArray(metrics?.weeks) ? metrics.weeks : [];
                const n = weeks.length;
                if (v === fetchVersionRef.current) {
                    setThisWeekRate(n ? weeks[n - 1]?.rate || 0 : 0);
                    setLastWeekRate(n > 1 ? weeks[n - 2]?.rate || 0 : 0);
                }
            } catch { setAvgWeeklyRate(0); setStreakDays(0); setBestWeekLabel(undefined); setBestWeekRate(0); setThisWeekRate(0); setLastWeekRate(0); }

            // Compute insights after data loaded
            try {
                if (v === fetchVersionRef.current) {
                    const suggestions: string[] = [];
                    const actNameMap: Record<string, string> = Object.fromEntries((currentActs || []).map((a) => [String(a.id), a.name]));
                    const doneByDay: Record<string, Set<string>> = {};
                    // Build per-day activity set from last 30 logs
                    // We re-fetch logs30 in scope; alternatively reuse done above
                    // Use recentCompletions and activities to estimate frequency
                    // Simple frequency by name over 7 and 30 days
                    // Identify common activities
                    const common = ['coffee', 'gym', 'creatine', 'vitamin', 'vitamins'];
                    const nameLowerMap: Record<string, string> = {};
                    for (const a of currentActs) nameLowerMap[a.id] = a.name.toLowerCase();

                    // Build frequency maps from the already computed 'recentCompletions' and logs last 30 via topActivities30 source
                    // Since we have only counts aggregated, do a quick fetch of logs30 again for accurate per-day sets
                    let logs30Full: Log[] = [];
                    try {
                        const res = await fetch(`/api/logs?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
                        logs30Full = res.ok ? await res.json() : [];
                    } catch {}
                    for (const l of logs30Full.filter((x) => x.completed)) {
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

                    const freq7: Record<string, number> = {};
                    const freq30: Record<string, number> = {};
                    for (const [day, set] of Object.entries(doneByDay)) {
                        for (const id of set) {
                            freq30[id] = (freq30[id] || 0) + 1;
                            if (last7Days.includes(day)) freq7[id] = (freq7[id] || 0) + 1;
                        }
                    }

                    // Weight trend
                    let weightTrend = 0;
                    if (weights30.length >= 2) {
                        const w0 = weights30[0].weight;
                        const wN = weights30[weights30.length - 1].weight;
                        weightTrend = wN - w0;
                        const changeStr = `${weightTrend >= 0 ? '+' : ''}${Math.round(weightTrend * 10) / 10} kg over 30d`;
                        suggestions.push(`Weight trend: ${changeStr}`);
                    }

                    // Compute category frequencies
                    const idsFor = (names: string[]) => {
                        const set = new Set(names.map((n) => n.toLowerCase()));
                        return Object.keys(nameLowerMap).filter((id) => set.has(nameLowerMap[id]));
                    };
                    const gymIds = idsFor(['gym', 'crossfit', 'squash', 'climb']);
                    const gym7 = gymIds.reduce((acc, id) => acc + (freq7[id] || 0), 0);
                    const coffeeIds = idsFor(['coffee']);
                    const coffee7 = coffeeIds.reduce((acc, id) => acc + (freq7[id] || 0), 0);
                    const suppIds = idsFor(['creatine', 'protein powder', 'vitamins']);
                    const supp7 = suppIds.reduce((acc, id) => acc + (freq7[id] || 0), 0);
                    const adherence = suppIds.length ? Math.round((supp7 / (7 * suppIds.length)) * 100) : 0;
                    const contentIds = idsFor(['post story', 'post reel']);
                    const content7 = contentIds.reduce((acc, id) => acc + (freq7[id] || 0), 0);
                    const alcoholIds = idsFor(['alcohol']);
                    const alcohol7 = alcoholIds.reduce((acc, id) => acc + (freq7[id] || 0), 0);
                    const vgIds = idsFor(['video games']);
                    const vg7 = vgIds.reduce((acc, id) => acc + (freq7[id] || 0), 0);

                    // Suggestions based on categories
                    if (gymIds.length) {
                        suggestions.push(`Gym: ${gym7} of last 7 days`);
                        if (gym7 <= 2) suggestions.push(`Consider scheduling more gym days (≤2 of last 7).`);
                    }
                    if (coffeeIds.length) {
                        suggestions.push(`Coffee: ${coffee7} of last 7 days`);
                        if (coffee7 >= 6) suggestions.push(`High coffee frequency (≥6 of 7). Consider reducing for balance.`);
                    }
                    if (suppIds.length) {
                        suggestions.push(`Supplements: ${adherence}% adherence (last 7 days)`);
                        if (adherence < 60) suggestions.push(`Supplements adherence is low (<60%). Plan daily reminders.`);
                    }
                    if (alcoholIds.length) {
                        suggestions.push(`Alcohol: ${alcohol7} of last 7 days`);
                        if (alcohol7 >= 3) suggestions.push(`Consider reducing alcohol (≥3 of 7) to support recovery.`);
                        if (weightTrend > 0 && alcohol7 >= 2) suggestions.push(`Weight increasing with alcohol ≥2 of 7; reduce intake.`);
                    }
                    if (vgIds.length && vg7 >= 5) {
                        suggestions.push(`High gaming (≥5/7). Consider a digital detox day.`);
                    }
                    suggestions.push(`Content: ${content7} posts in last 7 days`);
                    if (content7 < 3 && contentIds.length) suggestions.push(`Plan ≥3 content posts in the next 7 days.`);

                    // Highlight engagement
                    const highlightDays = highlights30.length;
                    suggestions.push(`Highlights: ${highlightDays} of last 30 days logged`);
                    if (highlightDays < 10) suggestions.push(`Consider journaling highlights more often (<10 of last 30).`);

                    // Low-activity focus (last 7)
                    const lowActs = Object.keys(freq7)
                      .map((id) => ({ id, count: freq7[id], name: actNameMap[id] || id }))
                      .sort((a, b) => a.count - b.count)
                      .slice(0, 3);
                                        for (const la of lowActs) {
                                            suggestions.push(`${la.name}: ${la.count} of last 7 days (low). Schedule sessions.`);
                                        }

                    // Next 7-day plan (simple forecast)
                    if (gymIds.length && gym7 < 3) suggestions.push(`Next 7 plan: Aim for 3 gym days.`);
                    if (coffeeIds.length && coffee7 > 4) suggestions.push(`Next 7 plan: Keep coffee ≤4 days.`);
                    if (suppIds.length && adherence < 80) suggestions.push(`Next 7 plan: Take supplements daily (7 of 7 days).`);
                    if (contentIds.length && content7 < 3) suggestions.push(`Next 7 plan: Post ≥3 stories/reels.`);

                    setInsights(suggestions);
                }
            } catch {}
        }
        if (account) load();
    }, [account]);

    const last7Expected = activities.length * 7;

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
                                <LineChart data={weights30} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="date" tick={false} axisLine={false} />
                                    <YAxis tick={false} axisLine={false} domain={['auto', 'auto']} />
                                    <Tooltip formatter={(v: any) => [`${v} kg`, 'Weight']} labelFormatter={(l: any) => l} />
                                    <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : null}
                    </div>
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
