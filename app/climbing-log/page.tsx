"use client";

import { useEffect, useRef, useState } from 'react';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) { const [y, m, d] = s.split('-').map((x)=>parseInt(x,10)); return new Date(y, (m||1)-1, d||1); }

export default function ClimbingLogPage() {
  const today = localTodayISO();
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
  const ctrlRef = useRef<AbortController | null>(null);
  // All logs pagination
  const [allPage, setAllPage] = useState<number>(1);
  const allLimit = 10;
  const [allItems, setAllItems] = useState<Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [allTotal, setAllTotal] = useState<number>(0);
  const [allLoading, setAllLoading] = useState<boolean>(false);
  // Set Goal form
  const [goalForm, setGoalForm] = useState<{ year: number; type: 'boulder'|'rope'; grade: string; target: number }>({ year: new Date().getFullYear(), type: 'boulder', grade: 'V4', target: 100 });

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
    if (res.ok) { setGrade(type==='boulder'?'V4':'6a'); setAttempts(1); setFlash(false); setLocation(''); setNotes(''); refresh(); }
  }

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}&account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
    refreshAll(allPage);
  }

  const boulderGrades = Array.from({ length: 13 }, (_, i) => `V${i}`);
  const frenchGrades = ['5a','5a+','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c'];

  async function saveGoal() {
    const res = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalForm) });
    if (res.ok) {/* no-op */}
  }

  return (
    <section className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-medium">Climbing Log</div>
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-start">
              <input type="date" className="input w-full" value={date} onChange={(e)=>setDate(e.target.value)} />
              <input type="number" min={1} className="input w-full" value={session} onChange={(e)=>setSession(parseInt(e.target.value||'1',10)||1)} placeholder="Session #" />
              <select className="input w-full" value={type} onChange={(e)=>{ const t = e.target.value as 'boulder'|'rope'; setType(t); setGrade(t==='boulder' ? 'V4' : '6a'); }}>
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
        onPrev={()=>{ const maxPage = Math.max(1, Math.ceil(allTotal / allLimit)); if (allPage < maxPage) { const p=allPage+1; refreshAll(p);} }}
        onNext={()=>{ if (allPage>1) { const p=allPage-1; refreshAll(p);} }}
        onDelete={(id)=>{ removeLog(id); }}
      />
      <div className="card p-4">
        <div className="card-title">Set Goal</div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input type="number" className="input" value={goalForm.year} onChange={(e)=>setGoalForm({ ...goalForm, year: parseInt(e.target.value||String(new Date().getFullYear()),10)||new Date().getFullYear() })} />
          <select className="input" value={goalForm.type} onChange={(e)=>{ const t = e.target.value as 'boulder'|'rope'; setGoalForm({ ...goalForm, type: t, grade: t==='boulder' ? 'V4' : '6a' }); }}>
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
    </section>
  );
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
        <button className="btn-outline" disabled={page>=maxPage} onClick={onPrev}>Previous</button>
        <button className="btn-outline" disabled={page<=1} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
