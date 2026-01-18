"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map((x)=>parseInt(x,10));
  return new Date(y, (m||1)-1, d||1);
}
function toLocalISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function vScaleToNumber(grade: string): number | null {
  const m = /^v\s*(\d+)$/i.exec(grade.trim());
  if (!m) return null; return parseInt(m[1], 10);
}

const boulderGrades = Array.from({ length: 13 }, (_, i) => `V${i}`); // V0..V12
const frenchGrades = [
  '5a','5a+','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c'
];
function frenchToIndex(g: string): number | null {
  const idx = frenchGrades.findIndex((x) => x.toLowerCase() === g.trim().toLowerCase());
  return idx >= 0 ? idx : null;
}

function weekStartLocal(d: Date) {
  const day = d.getDay() || 7; // Sun=0, Mon=1..Sun=7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
  return start;
}

export default function ClimbingView() {
  const today = useMemo(() => localTodayISO(), []);
  const [account, setAccount] = useState<string>('Alex');
  const [date, setDate] = useState<string>(today);
  const [logs, setLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [rangeLogs, setRangeLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; year: number; type: 'boulder'|'rope'; grade: string; target: number }>>([]);
  const [yearLogs, setYearLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [yearLogsByYear, setYearLogsByYear] = useState<Record<number, Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>>({});
  const [selectedGoal, setSelectedGoal] = useState<{ id: string; year: number; type: 'boulder'|'rope'; grade: string; target: number } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cookieAccount = (() => { try { const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; } })();
    const init = cookieAccount || (typeof window !== 'undefined' ? localStorage.getItem('account') : null);
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    const onAccountChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const cookieAcc = (() => { try { const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; } })();
      setAccount(detail || cookieAcc || (typeof window !== 'undefined' ? localStorage.getItem('account') : null) || 'Alex');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('account-change', onAccountChange as EventListener);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('account-change', onAccountChange as EventListener); };
  }, []);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();
      const res = await fetch(`/api/climbing/logs?date=${date}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal });
      const items = res.ok ? await res.json() : [];
      setLogs(Array.isArray(items) ? items : []);
      const gRes = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`);
      const gs = gRes.ok ? await gRes.json() : [];
      setGoals(Array.isArray(gs) ? gs : []);
      // Also fetch a rolling 120-day window for trends and weekly stats
      const end = parseLocalDate(date);
      const start = new Date(end);
      start.setDate(start.getDate() - 119);
      const fromISO = toLocalISO(start);
      const toISO = toLocalISO(end);
      const rRes = await fetch(`/api/climbing/logs?from=${fromISO}&to=${toISO}&account=${encodeURIComponent(account)}`);
      const rItems = rRes.ok ? await rRes.json() : [];
      setRangeLogs(Array.isArray(rItems) ? rItems : []);
      // Fetch logs per goal year for accurate progress
      const gYears = Array.isArray(gs) ? Array.from(new Set(gs.map((g: any) => g.year))) : [];
      if (gYears.length) {
        const entries = await Promise.all(gYears.map(async (yr: number) => {
          const yrStart = `${yr}-01-01`;
          const yrEnd = `${yr}-12-31`;
          const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}&account=${encodeURIComponent(account)}`);
          const items = resp.ok ? await resp.json() : [];
          return [yr, Array.isArray(items) ? items : []] as const;
        }));
        const map: Record<number, Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>> = {};
        for (const [yr, arr] of entries) { map[yr] = arr; }
        setYearLogsByYear(map);
      } else {
        setYearLogsByYear({});
      }
    } catch { setLogs([]); }
  }

  useEffect(() => { refresh(); }, [date, account]);

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}&account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
  }

  const thisYear = new Date().getFullYear();
  const logs30 = useMemo(() => {
    const d = parseLocalDate(date);
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const from = new Date(to); from.setDate(from.getDate()-29);
    return rangeLogs.filter((l) => {
      const t = parseLocalDate(l.date).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });
  }, [rangeLogs, date]);

  const sessionsToday = useMemo(() => {
    const maxSes = logs.reduce((acc, l) => l.session > acc ? l.session : acc, 0);
    return maxSes;
  }, [logs]);

  const stats = useMemo(() => {
    const total = logs30.length;
    const flashes = logs30.filter((l) => l.attempts === 0).length;
    const avgAttempts = total ? Math.round((logs30.reduce((acc, l) => acc + (l.attempts || 0), 0) / total) * 10) / 10 : 0;
    const vNums = logs30.filter((l)=>l.type==='boulder').map((l) => vScaleToNumber(l.grade)).filter((n): n is number => n != null);
    const vTrend = vNums.length >= 2 ? (vNums[vNums.length-1] - vNums[0]) : 0;
    const ropeNums = logs30.filter((l)=>l.type==='rope').map((l)=> frenchToIndex(l.grade)).filter((n): n is number => n != null);
    const ropeTrend = ropeNums.length >= 2 ? (ropeNums[ropeNums.length-1] - ropeNums[0]) : 0;
    const half = Math.floor(logs30.length/2) || 1;
    const avgFirst = logs30.slice(0, half).reduce((a,l)=>a+(l.attempts||0),0) / Math.max(1, logs30.slice(0,half).length);
    const avgSecond = logs30.slice(half).reduce((a,l)=>a+(l.attempts||0),0) / Math.max(1, logs30.slice(half).length);
    const attemptsTrend = Math.round(((avgSecond - avgFirst)) * 10) / 10;
    return { total, flashes, flashRate: total? Math.round((flashes/total)*100) : 0, avgAttempts, vTrend, ropeTrend, attemptsTrend };
  }, [logs30]);

  const weekly = useMemo(() => {
    const end = parseLocalDate(date);
    const endStart = weekStartLocal(end);
    const buckets: Array<{ key: string; date: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(endStart);
      ws.setDate(ws.getDate() - i*7);
      const key = toLocalISO(ws);
      buckets.push({ key, date: key, count: 0 });
    }
    const map = new Map(buckets.map(b=>[b.key,b]));
    for (const l of rangeLogs) {
      const dt = parseLocalDate(l.date);
      const ws = weekStartLocal(dt);
      const key = toLocalISO(ws);
      const b = map.get(key);
      if (b) b.count += 1;
    }
    const arr = Array.from(map.values());
    const avg = arr.length ? Math.round((arr.reduce((a,b)=>a+b.count,0)/arr.length)*10)/10 : 0;
    const activeWeeks = arr.filter((w)=>w.count>0).length;
    return { series: arr, avg, activeWeeks };
  }, [rangeLogs, date]);

  const consistency = useMemo(() => {
    const end = new Date(date);
    const start = new Date(end); start.setDate(start.getDate()-6);
    const set = new Set(rangeLogs
      .filter((l)=>{ const t=new Date(l.date).getTime(); return t>=start.getTime() && t<=end.getTime(); })
      .map((l)=> l.date.slice(0,10))
    );
    const days = set.size;
    const weeksActiveRate = weekly.series.length ? Math.round((weekly.activeWeeks/weekly.series.length)*100) : 0;
    return { daysLast7: days, weeksActive: weekly.activeWeeks, weeksTotal: weekly.series.length, weeksActiveRate };
  }, [rangeLogs, date, weekly]);

  const byGrade30 = useMemo(() => {
    const map: Record<string, { count: number; flashes: number; attempts: number }> = {};
    for (const l of logs30) {
      const k = `${l.type}|${l.grade.toLowerCase()}`;
      const m = (map[k] ||= { count: 0, flashes: 0, attempts: 0 });
      m.count += 1; m.attempts += (l.attempts||0); if (l.attempts===0) m.flashes += 1;
    }
    const rows = Object.entries(map).map(([key, v]) => {
      const [type, grade] = key.split('|');
      const avgAtt = v.count ? Math.round((v.attempts/v.count)*10)/10 : 0;
      const flashRate = v.count ? Math.round((v.flashes/v.count)*100) : 0;
      return { type, grade, count: v.count, flashRate, avgAttempts: avgAtt };
    }).sort((a,b)=> b.count - a.count).slice(0,8);
    return rows;
  }, [logs30]);

  

  const goalsProgress = useMemo(() => {
    return goals.map((g) => {
      const logsForYear = yearLogsByYear[g.year] || [];
      const done = logsForYear.reduce((acc, l) => {
        return acc + ((l.type === g.type && l.grade.toLowerCase() === g.grade.toLowerCase()) ? 1 : 0);
      }, 0);
      const pct = g.target ? Math.min(100, Math.round((done / g.target) * 100)) : 0;
      return { ...g, done, pct };
    });
  }, [goals, yearLogsByYear]);

  const [goalsYear, setGoalsYear] = useState<number>(thisYear);
  const goalsYears = useMemo(() => {
    const set = new Set(goalsProgress.map((g)=> g.year));
    return Array.from(set).sort((a,b)=> a-b);
  }, [goalsProgress]);
  useEffect(() => {
    if (goalsYears.length === 0) return;
    if (goalsYears.includes(thisYear)) setGoalsYear(thisYear);
    else setGoalsYear(goalsYears[goalsYears.length-1]);
  }, [goalsYears]);
  const goalsForSelectedYear = useMemo(() => {
    return goalsProgress
      .filter((g)=> g.year === goalsYear)
      .slice()
      .sort((a,b)=> b.pct - a.pct || (b.done - a.done));
  }, [goalsProgress, goalsYear]);

  const yearSummary = useMemo(() => {
    const ylogs = yearLogsByYear[goalsYear] || [];
    const total = ylogs.length;
    if (!total) {
      return { total: 0, flashes: 0, flashRate: 0, avgAttempts: 0, days: 0, weeks: 0, weeklyAvg: 0, bestWeek: 0, bestBoulder: null as null | string, bestRope: null as null | string, series: [] as Array<{ date: string; count: number }> };
    }
    const flashes = ylogs.filter((l)=> l.attempts === 0).length;
    const flashRate = Math.round((flashes / total) * 100);
    const avgAttempts = Math.round((ylogs.reduce((a,l)=> a + (l.attempts || 0), 0) / total) * 10) / 10;
    const daySet = new Set(ylogs.map((l)=> l.date.slice(0,10)));
    const days = daySet.size;
    const weekMap = new Map<string, number>();
    for (const l of ylogs) {
      const ws = weekStartLocal(parseLocalDate(l.date));
      const key = toLocalISO(ws);
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    }
    const weeks = weekMap.size;
    const weeklyCounts = Array.from(weekMap.values());
    const weeklyAvg = weeklyCounts.length ? Math.round((weeklyCounts.reduce((a,b)=>a+b,0) / weeklyCounts.length) * 10) / 10 : 0;
    const bestWeek = weeklyCounts.reduce((m,c)=> Math.max(m,c), 0);
    const series = Array.from(weekMap.entries()).sort((a,b)=> a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
    const boulderNums = ylogs.filter((l)=> l.type==='boulder').map((l)=> vScaleToNumber(l.grade)).filter((n): n is number => n != null);
    const bestBoulder = boulderNums.length ? `V${Math.max(...boulderNums)}` : null;
    const ropeIdxs = ylogs.filter((l)=> l.type==='rope').map((l)=> frenchToIndex(l.grade)).filter((n): n is number => n != null);
    const bestRope = ropeIdxs.length ? frenchGrades[Math.max(...ropeIdxs)] : null;
    return { total, flashes, flashRate, avgAttempts, days, weeks, weeklyAvg, bestWeek, bestBoulder, bestRope, series };
  }, [yearLogsByYear, goalsYear]);

  const goalLogs = useMemo(() => {
    if (!selectedGoal) return [] as Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>;
    const keyType = selectedGoal.type;
    const keyGrade = selectedGoal.grade.toLowerCase();
    const logsForYear = yearLogsByYear[selectedGoal.year] || [];
    return logsForYear
      .filter((l) => l.type === keyType && l.grade.toLowerCase() === keyGrade)
      .sort((a,b)=> parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [yearLogsByYear, selectedGoal]);

  const goalProgressSeries = useMemo(() => {
    if (!selectedGoal) return { series: [] as Array<{ date: string; actual: number; ideal: number; recentPace: number }>, done: 0, recentAvg: 0 };
    const yr = selectedGoal.year;
    const start = new Date(yr, 0, 1);
    const end = new Date(yr, 11, 31);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    let actual = 0;
    const byDay = new Map<string, number>();
    for (const l of goalLogs) {
      const d = toLocalISO(parseLocalDate(l.date));
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    // Recent 6-week weighted average
    const weeklyMap = new Map<string, number>();
    for (const l of goalLogs) {
      const dt = parseLocalDate(l.date);
      const ws = weekStartLocal(dt);
      const key = toLocalISO(ws);
      weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1);
    }
    const weeklySeries = Array.from(weeklyMap.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
    const lastSix = weeklySeries.slice(-6);
    const weights = lastSix.map((_,i)=> i+1);
    const wsum = weights.reduce((a,b)=>a+b,0) || 1;
    const recentAvg = lastSix.length ? Math.round((lastSix.reduce((acc, [_, c], i) => acc + c * weights[i], 0) / wsum) * 10) / 10 : 0;
    const series: Array<{ date: string; actual: number; ideal: number; recentPace: number }> = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toLocalISO(d);
      const inc = byDay.get(iso) || 0;
      actual += inc;
      const ideal = Math.round((selectedGoal.target * (i / (totalDays - 1))) * 10) / 10;
      const recentPace = Math.round(((recentAvg * (i / 7))) * 10) / 10;
      series.push({ date: iso, actual, ideal, recentPace });
    }
    return { series, done: actual, recentAvg };
  }, [selectedGoal, goalLogs]);

  const goalWeekly = useMemo(() => {
    if (!selectedGoal) return { series: [] as Array<{ date: string; count: number }>, avg: 0, activeWeeks: 0, bestWeek: 0, byWeekDates: new Map<string, string[]>() };
    const bucketsMap = new Map<string, { date: string; count: number }>();
    const datesMap = new Map<string, string[]>();
    for (const l of goalLogs) {
      const dt = parseLocalDate(l.date);
      const ws = weekStartLocal(dt);
      const key = toLocalISO(ws);
      const b = bucketsMap.get(key) || { date: key, count: 0 };
      b.count += 1;
      bucketsMap.set(key, b);
      const arr = datesMap.get(key) || [];
      arr.push(l.date.slice(0,10));
      datesMap.set(key, arr);
    }
    const series = Array.from(bucketsMap.values()).sort((a,b)=> a.date.localeCompare(b.date));
    const avg = series.length ? Math.round((series.reduce((a,b)=>a+b.count,0) / series.length) * 10) / 10 : 0;
    const activeWeeks = series.filter((w)=>w.count>0).length;
    const bestWeek = series.reduce((m,w)=> Math.max(m,w.count), 0);
    return { series, avg, activeWeeks, bestWeek, byWeekDates: datesMap };
  }, [selectedGoal, goalLogs]);

  const goalFlashPie = useMemo(() => {
    if (!selectedGoal) return { flash: 0, nonFlash: 0 };
    let flash = 0, nonFlash = 0;
    for (const l of goalLogs) { if (l.attempts === 0) flash++; else nonFlash++; }
    return { flash, nonFlash };
  }, [selectedGoal, goalLogs]);

  const goalAttemptsDist = useMemo(() => {
    if (!selectedGoal) return [
      { bucket: '0', count: 0 },
      { bucket: '1', count: 0 },
      { bucket: '2', count: 0 },
      { bucket: '3', count: 0 },
      { bucket: '4+', count: 0 },
    ];
    const buckets = { '0': 0, '1': 0, '2': 0, '3': 0, '4+': 0 } as Record<string, number>;
    for (const l of goalLogs) {
      const a = l.attempts || 0;
      if (a <= 0) buckets['0'] += 1;
      else if (a === 1) buckets['1'] += 1;
      else if (a === 2) buckets['2'] += 1;
      else if (a === 3) buckets['3'] += 1;
      else buckets['4+'] += 1;
    }
    return Object.entries(buckets).map(([bucket, count])=> ({ bucket, count }));
  }, [selectedGoal, goalLogs]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="card-title">Goals ({goalsYear || thisYear})</div>
            <div className="flex items-center gap-2">
              <button className="btn-outline text-xs" disabled={!goalsYears.length || goalsYear === goalsYears[0]} onClick={()=>{
                const idx = goalsYears.indexOf(goalsYear);
                if (idx > 0) setGoalsYear(goalsYears[idx-1]);
              }}>Prev</button>
              <button className="btn-outline text-xs" disabled={!goalsYears.length || goalsYear === goalsYears[goalsYears.length-1]} onClick={()=>{
                const idx = goalsYears.indexOf(goalsYear);
                if (idx >= 0 && idx < goalsYears.length-1) setGoalsYear(goalsYears[idx+1]);
              }}>Next</button>
            </div>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {goalsForSelectedYear.length ? goalsForSelectedYear.map((g)=> (
              <li key={g.id} className="rounded border p-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900" onClick={()=>setSelectedGoal({ id: g.id, year: g.year, type: g.type, grade: g.grade, target: g.target })}>
                <div className="flex items-center justify-between">
                  <span>{g.type} • {g.grade}</span>
                  <span className="flex items-center gap-2">
                    <span className="subtle">{g.done}/{g.target}</span>
                    <span className="text-xs">{goalStatusText(g.year, g.done, g.target)}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded bg-neutral-200 dark:bg-neutral-800">
                  <div className="h-2 rounded bg-(--accent)" style={{ width: `${g.pct}%` }} />
                </div>
                <GoalPaceLine year={g.year} done={g.done} target={g.target} />
              </li>
            )) : <li className="subtle">No goals for {goalsYear || thisYear}</li>}
          </ul>
          <div className="mt-3">
            <div className="font-medium">Year Summary</div>
            {yearSummary.total ? (
              <>
              <div className="mt-2 h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearSummary.series} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={false} axisLine={false} />
                    <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                    <Tooltip formatter={(v: any) => [String(v), 'Completions']} labelFormatter={(l: any) => `Week of ${l}`} />
                    <ReferenceLine y={yearSummary.weeklyAvg} stroke="#9CA3AF" strokeDasharray="3 3" />
                    <Bar dataKey="count">
                      {yearSummary.series.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count >= yearSummary.weeklyAvg ? '#16a34a' : '#9CA3AF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex justify-between"><span>Total climbs</span><span className="subtle">{yearSummary.total}</span></li>
                <li className="flex justify-between"><span>Flash rate</span><span className="subtle">{yearSummary.flashRate}%</span></li>
                <li className="flex justify-between"><span>Avg attempts</span><span className="subtle">{yearSummary.avgAttempts}</span></li>
                <li className="flex justify-between"><span>Active weeks</span><span className="subtle">{yearSummary.weeks}</span></li>
                <li className="flex justify-between"><span>Weekly avg</span><span className="subtle">{yearSummary.weeklyAvg}</span></li>
                <li className="flex justify-between"><span>Best week</span><span className="subtle">{yearSummary.bestWeek}</span></li>
                <li className="flex justify-between"><span>Days climbed</span><span className="subtle">{yearSummary.days}</span></li>
                <li className="flex justify-between"><span>Best boulder</span><span className="subtle">{yearSummary.bestBoulder || '—'}</span></li>
                <li className="flex justify-between"><span>Best rope</span><span className="subtle">{yearSummary.bestRope || '—'}</span></li>
              </ul>
              </>
            ) : (
              <div className="subtle mt-2">No logs for this year.</div>
            )}
          </div>
        </div>
        <div className="card p-4">
          <div className="card-title">Last 30 Days</div>
          <div className="text-2xl font-semibold">{stats.total} climbs</div>
          <div className="subtle">{stats.flashRate}% flash • avg {stats.avgAttempts} attempts</div>
          <div className="subtle">Boulder trend: {stats.vTrend>=0? '+' : ''}{stats.vTrend} • Rope trend: {stats.ropeTrend>=0? '+' : ''}{stats.ropeTrend}</div>
          <div className="subtle">Attempts trend (30d): {stats.attemptsTrend<=0? 'improving' : 'worse'} ({stats.attemptsTrend})</div>
        </div>
        <div className="card p-4">
          <div className="card-title">Weekly Sessions (12w)</div>
          <div className="mt-2 h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly.series} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                <Tooltip formatter={(v: any) => [String(v), 'Sessions']} labelFormatter={(l: any) => l} />
                <ReferenceLine y={weekly.avg} stroke="#9CA3AF" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="subtle mt-1">Avg: {weekly.avg} • Active weeks: {weekly.activeWeeks}/{weekly.series.length}</div>
        </div>
        <div className="card p-4">
          <div className="card-title">Consistency</div>
          <div className="text-2xl font-semibold">{consistency.weeksActiveRate}%</div>
          <div className="subtle">Weeks active (12w): {consistency.weeksActive}/{consistency.weeksTotal}</div>
          <div className="subtle">Days climbed (7d): {consistency.daysLast7}/7</div>
        </div>
        <div className="card p-4">
          <div className="card-title">By Grade (30d)</div>
          <ul className="mt-2 space-y-1 text-sm">
            {byGrade30.length ? byGrade30.map((r)=> (
              <li key={`${r.type}|${r.grade}`} className="flex justify-between">
                <span>{r.type} • {r.grade}</span>
                <span className="subtle">{r.count} • {r.flashRate}% flash • {r.avgAttempts} att</span>
              </li>
            )) : <li className="subtle">No recent data</li>}
          </ul>
        </div>
        {/* Goal input removed; use /climbing-goals */}
      </div>
      {selectedGoal && (
        <GoalOverlay
          goal={selectedGoal}
          progressSeries={goalProgressSeries.series}
          weeklySeries={goalWeekly.series}
          weeklyAvg={goalWeekly.avg}
          weeklyRecentAvg={goalProgressSeries.recentAvg}
          bestWeek={goalWeekly.bestWeek}
          flashPie={goalFlashPie}
          attemptsDist={goalAttemptsDist}
          goalItems={goalLogs}
          byWeekDates={goalWeekly.byWeekDates}
          onClose={()=>setSelectedGoal(null)}
        />
      )}
    </section>
  );
}

function daysUntilYearEnd(year: number) {
  const now = new Date();
  const end = new Date(year, 11, 31);
  const ms = end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function GoalPaceLine({ year, done, target }: { year: number; done: number; target: number }) {
  const daysLeft = daysUntilYearEnd(year);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const remaining = Math.max(0, target - done);
  const perWeek = Math.round((remaining / weeksLeft) * 10) / 10;
  return <div className="mt-1 subtle">Pace needed: {perWeek}/week</div>;
}

// All Logs component moved to Climbing Log page

function goalStatusText(year: number, done: number, target: number) {
  const nowYear = new Date().getFullYear();
  const ended = nowYear > year;
  if (done >= target) return '✅ Succeeded';
  if (ended) return '❌ Failed';
  return '⏳ In progress';
}

function GoalOverlay({ goal, progressSeries, weeklySeries, weeklyAvg, weeklyRecentAvg, bestWeek, flashPie, attemptsDist, goalItems, byWeekDates, onClose }:{
  goal: { id: string; year: number; type: 'boulder'|'rope'; grade: string; target: number };
  progressSeries: Array<{ date: string; actual: number; ideal: number; recentPace: number }>;
  weeklySeries: Array<{ date: string; count: number }>;
  weeklyAvg: number;
  weeklyRecentAvg: number;
  bestWeek: number;
  flashPie: { flash: number; nonFlash: number };
  attemptsDist: Array<{ bucket: string; count: number }>;
  goalItems: Array<{ id: string; date: string; session: number; attempts: number; location?: string; notes?: string }>;
  byWeekDates: Map<string, string[]>;
  onClose: ()=>void;
}) {
  const total = flashPie.flash + flashPie.nonFlash;
  const flashRate = total ? Math.round((flashPie.flash / total) * 100) : 0;
  const avgAttempts = attemptsDist.reduce((acc, b) => acc + (b.bucket==='0'?0:(b.bucket==='4+'?4:parseInt(b.bucket,10))) * b.count, 0);
  const avgAttemptsDen = attemptsDist.reduce((acc,b)=> acc + b.count, 0);
  const avgAttemptsVal = avgAttemptsDen ? Math.round((avgAttempts / avgAttemptsDen) * 10) / 10 : 0;
  const daysLeft = daysUntilYearEnd(goal.year);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const done = progressSeries.length ? progressSeries[progressSeries.length-1].actual : 0;
  const projection = Math.round(done + weeklyRecentAvg * weeksLeft);
  const pct = goal.target ? Math.min(100, Math.round((done / goal.target) * 100)) : 0;

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
          <button className="btn-outline" onClick={onClose}>Close</button>
        </div>
        <div className="mt-3 grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="font-medium mb-2">Progress vs Pace</div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressSeries} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={false} axisLine={false} />
                  <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip formatter={(v: any, n: any) => [String(v), n==='actual'?'Actual':(n==='recentPace'?'Recent Pace':'Ideal')]} labelFormatter={(l: any) => l} />
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
                      <Cell key={`cell-${index}`} fill={index===0? '#16a34a' : '#6B7280'} />
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
              <li><span className="subtle">Active weeks:</span> {weeklySeries.filter((w)=>w.count>0).length}/{weeklySeries.length}</li>
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
                .sort((a,b)=> (a.attempts - b.attempts) || (parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()))
                .slice(0, 8)
                .map((s)=> (
                  <li key={`${s.id}`} className="flex justify-between">
                    <span>{s.date.slice(0,10)} • S{s.session} • {s.attempts===0? 'flash' : `${s.attempts} att`}</span>
                    <span className="subtle">{s.location || ''}{s.notes ? ` • ${s.notes}` : ''}</span>
                  </li>
                ))}
              {goalItems.length===0 && <li className="subtle">No sessions for this goal.</li>}
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

function WeekTooltip({ active, payload, label, datesMap }:{ active: boolean; payload?: any[]; label?: string; datesMap: Map<string,string[]> }) {
  if (active && payload && payload.length) {
    const key = String(label || '');
    const dates = datesMap.get(key) || [];
    return (
      <div className="card p-2 text-xs">
        <div className="font-medium">Week of {key}</div>
        <ul className="mt-1 space-y-1">
          {dates.map((d,i)=> (<li key={`${d}-${i}`}>{d}</li>))}
          {dates.length===0 && (<li className="subtle">No completions</li>)}
        </ul>
      </div>
    );
  }
  return null;
}
