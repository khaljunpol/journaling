"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

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

export default function ClimbingView() {
  const today = useMemo(() => localTodayISO(), []);
  const [account, setAccount] = useState<string>('Alex');
  const [date, setDate] = useState<string>(today);
  const [session, setSession] = useState<number>(1);
  const [type, setType] = useState<'boulder'|'rope'>('boulder');
  const [grade, setGrade] = useState<string>('V4');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(1);
  const [flash, setFlash] = useState<boolean>(false);
  const [logs, setLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [rangeLogs, setRangeLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; year: number; type: 'boulder'|'rope'; grade: string; target: number }>>([]);
  const [yearLogs, setYearLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [goalForm, setGoalForm] = useState<{ year: number; type: 'boulder'|'rope'; grade: string; target: number }>({ year: new Date().getFullYear(), type: 'boulder', grade: 'V4', target: 100 });
  // All logs pagination
  const [allPage, setAllPage] = useState<number>(1);
  const allLimit = 10;
  const [allItems, setAllItems] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [allTotal, setAllTotal] = useState<number>(0);
  const [allLoading, setAllLoading] = useState<boolean>(false);
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
      // Fetch current year range for goals progress
      const yr = end.getFullYear();
      const yrStart = `${yr}-01-01`;
      const yrEnd = `${yr}-12-31`;
      const yRes = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}&account=${encodeURIComponent(account)}`);
      const yItems = yRes.ok ? await yRes.json() : [];
      setYearLogs(Array.isArray(yItems) ? yItems : []);
    } catch { setLogs([]); }
  }

  useEffect(() => { refresh(); }, [date, account]);

  async function refreshAll(page = 1) {
    setAllLoading(true);
    try {
      const res = await fetch(`/api/climbing/logs?account=${encodeURIComponent(account)}&limit=${allLimit}&page=${page}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
          setAllItems(data.items);
          setAllTotal(data.total || 0);
          setAllPage(data.page || 1);
        } else if (Array.isArray(data)) {
          setAllItems(data.slice(0, allLimit));
          setAllTotal(data.length);
          setAllPage(1);
        }
      }
    } finally { setAllLoading(false); }
  }

  useEffect(() => { refreshAll(1); }, [account]);

  async function addLog() {
    const body = { date, session, type, grade: grade.trim(), attempts: flash ? 0 : attempts, location: location.trim(), notes: notes.trim() };
    const res = await fetch(`/api/climbing/logs?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setGrade(type==='boulder'?'V4':'6a'); setAttempts(1); setFlash(false); setLocation(''); setNotes(''); refresh(); refreshAll(1); }
  }

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}&account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
  }

  async function saveGoal() {
    const res = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalForm) });
    if (res.ok) refresh();
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
    function weekStartLocal(d: Date) {
      const day = d.getDay() || 7; // Sun=0, Mon=1..Sun=7
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
      return start;
    }
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
    const counts: Record<string, number> = {};
    for (const l of yearLogs) {
      const key = `${l.type}|${l.grade.toLowerCase()}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return goals.map((g) => {
      const key = `${g.type}|${g.grade.toLowerCase()}`;
      const done = counts[key] || 0;
      const pct = g.target ? Math.min(100, Math.round((done / g.target) * 100)) : 0;
      return { ...g, done, pct };
    });
  }, [goals, yearLogs]);

  return (
    <section className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-medium">Climbing Log</div>
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-start">
              <input type="date" className="input w-full" value={date} onChange={(e)=>setDate(e.target.value)} />
              <input type="number" min={1} className="input w-full" value={session} onChange={(e)=>setSession(parseInt(e.target.value||'1',10)||1)} placeholder="Session #" />
              <select className="input w-full" value={type} onChange={(e)=>{
                const t = e.target.value as 'boulder'|'rope';
                setType(t);
                setGrade(t==='boulder' ? 'V4' : '6a');
              }}>
                <option value="boulder">Boulder</option>
                <option value="rope">Rope</option>
              </select>
              <select className="input w-full" value={grade} onChange={(e)=>setGrade(e.target.value)}>
                {(type==='boulder'? boulderGrades : frenchGrades).map((g)=> (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input className="input w-full" placeholder="Location (optional)" value={location} onChange={(e)=>setLocation(e.target.value)} />
              <input className="input w-full" placeholder="Notes (optional)" value={notes} onChange={(e)=>setNotes(e.target.value)} />
              <div className="flex items-center gap-2">
                <input type="number" min={0} className="input w-full" value={flash?0:attempts} onChange={(e)=>{ setFlash(false); setAttempts(parseInt(e.target.value||'0',10)||0); }} placeholder="Attempts" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flash} onChange={(e)=>{ setFlash(e.target.checked); if (e.target.checked) setAttempts(0); }} /> Flash</label>
              </div>
              <button className="btn w-full sm:w-auto" onClick={addLog}>Add</button>
            </div>
          </div>
        </div>
        <div className="mt-3 subtle">Sessions today: {sessionsToday || 0}</div>
        <ul className="mt-2 space-y-2">
          {logs.map((l)=> (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
              <div className="text-sm">S{l.session} • {l.type} • {l.grade} • {l.attempts===0? 'flash' : `${l.attempts} attempts`}{l.location? ` • ${l.location}` : ''}</div>
              <button className="btn-outline text-xs" onClick={()=>removeLog(l.id)}>Delete</button>
            </li>
          ))}
          {logs.length===0 && <li className="subtle">No climbs logged for this day.</li>}
        </ul>
      </div>
      <AllLogsCard
        items={allItems}
        total={allTotal}
        page={allPage}
        limit={allLimit}
        loading={allLoading}
        onPrev={()=>{ if (allPage>1) { const p=allPage-1; refreshAll(p);} }}
        onNext={()=>{ const maxPage = Math.max(1, Math.ceil(allTotal / allLimit)); if (allPage < maxPage) { const p=allPage+1; refreshAll(p);} }}
        onDelete={(id)=>{ removeLog(id); refreshAll(allPage); }}
      />

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        <div className="card p-4">
          <div className="card-title">Last 30 Days</div>
          <div className="text-2xl font-semibold">{stats.total} climbs</div>
          <div className="subtle">{stats.flashRate}% flash • avg {stats.avgAttempts} attempts</div>
          <div className="subtle">Boulder trend: {stats.vTrend>=0? '+' : ''}{stats.vTrend} • Rope trend: {stats.ropeTrend>=0? '+' : ''}{stats.ropeTrend}</div>
          <div className="subtle">Attempts trend (30d): {stats.attemptsTrend<=0? 'improving' : 'worse'} ({stats.attemptsTrend})</div>
        </div>
        <div className="card p-4">
          <div className="card-title">Goals ({thisYear})</div>
          <ul className="mt-2 space-y-2 text-sm">
            {goalsProgress.length ? goalsProgress.map((g)=> (
              <li key={g.id} className="rounded border p-2">
                <div className="flex items-center justify-between"><span>{g.type} • {g.grade}</span><span className="subtle">{g.done}/{g.target}</span></div>
                <div className="mt-1 h-2 w-full rounded bg-neutral-200 dark:bg-neutral-800">
                  <div className="h-2 rounded bg-(--accent)" style={{ width: `${g.pct}%` }} />
                </div>
                <GoalPaceLine year={g.year} done={g.done} target={g.target} />
              </li>
            )) : <li className="subtle">No goals yet</li>}
          </ul>
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
        <div className="card p-4">
          <div className="card-title">Set Goal</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="number" className="input" value={goalForm.year} onChange={(e)=>setGoalForm({ ...goalForm, year: parseInt(e.target.value||String(thisYear),10)||thisYear })} />
            <select className="input" value={goalForm.type} onChange={(e)=>{
              const t = e.target.value as 'boulder'|'rope';
              setGoalForm({ ...goalForm, type: t, grade: t==='boulder' ? 'V4' : '6a' });
            }}>
              <option value="boulder">Boulder</option>
              <option value="rope">Rope</option>
            </select>
            <select className="input" value={goalForm.grade} onChange={(e)=>setGoalForm({ ...goalForm, grade: e.target.value })}>
              {(goalForm.type==='boulder'? boulderGrades : frenchGrades).map((g)=> (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input type="number" min={1} className="input" value={goalForm.target} onChange={(e)=>setGoalForm({ ...goalForm, target: parseInt(e.target.value||'1',10)||1 })} />
          </div>
          <div className="mt-2"><button className="btn" onClick={saveGoal}>Save Goal</button></div>
        </div>
      </div>
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

function AllLogsCard({ items, total, page, limit, loading, onPrev, onNext, onDelete }:{ items: Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>; total: number; page: number; limit: number; loading: boolean; onPrev: ()=>void; onNext: ()=>void; onDelete: (id: string)=>void }) {
  const maxPage = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="card-title">All Logs</div>
        <div className="text-sm subtle">Page {page} of {maxPage} • {total} total</div>
      </div>
      <div className="mt-2 w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left subtle">
              <th className="py-1 pr-2">Date</th>
              <th className="py-1 pr-2">S#</th>
              <th className="py-1 pr-2">Type</th>
              <th className="py-1 pr-2">Grade</th>
              <th className="py-1 pr-2">Attempts</th>
              <th className="py-1 pr-2">Location</th>
              <th className="py-1 pr-2">Notes</th>
              <th className="py-1 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l)=> (
              <tr key={l.id} className="border-t">
                <td className="py-1 pr-2 whitespace-nowrap">{l.date.slice(0,10)}</td>
                <td className="py-1 pr-2">{l.session}</td>
                <td className="py-1 pr-2 capitalize">{l.type}</td>
                <td className="py-1 pr-2">{l.grade}</td>
                <td className="py-1 pr-2">{l.attempts===0? 'flash' : l.attempts}</td>
                <td className="py-1 pr-2">{l.location || ''}</td>
                <td className="py-1 pr-2 max-w-[20rem] truncate" title={l.notes || ''}>{l.notes || ''}</td>
                <td className="py-1 pr-2 text-right"><button className="btn-outline text-xs" onClick={()=>onDelete(l.id)}>Delete</button></td>
              </tr>
            ))}
            {items.length===0 && (
              <tr><td colSpan={8} className="py-3 text-center subtle">{loading? 'Loading…' : 'No logs found'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button className="btn-outline" disabled={page<=1} onClick={onPrev}>Previous</button>
        <button className="btn-outline" disabled={page>=maxPage} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
