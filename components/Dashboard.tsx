"use client";

import { useEffect, useRef, useState } from 'react';

type Activity = { id: string; name: string };
type Log = { date: string; activityId: string; completed: boolean };
type Week = { week: string; rate: number };

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
    const fetchVersionRef = useRef(0);
    const actsCtrlRef = useRef<AbortController | null>(null);
    const logsTodayCtrlRef = useRef<AbortController | null>(null);
    const logs7CtrlRef = useRef<AbortController | null>(null);
    const logs30CtrlRef = useRef<AbortController | null>(null);
    const metricsCtrlRef = useRef<AbortController | null>(null);

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
        </main>
    );
}
