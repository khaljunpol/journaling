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
  // Goals and per-year logs cache for overlay progress
  const [goals, setGoals] = useState<Array<{ id: string; year: number; type: 'boulder'|'rope'; grade: string; target: number }>>([]);
  const [yearCache, setYearCache] = useState<Record<number, Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>>>({});
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

  // Prefetch goals (used for per-log overlays)
  useEffect(() => { (async () => { try { const gRes = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch {} })(); }, [account]);

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

  // Compute done/target for a given log (type+grade in log's year), fetching year logs if needed
  async function getProgressForLog(l: { date: string; type: 'boulder'|'rope'; grade: string }) {
    const yr = parseLocalDate(l.date).getFullYear();
    let yrLogs = yearCache[yr];
    if (!yrLogs) {
      try {
        const yrStart = `${yr}-01-01`; const yrEnd = `${yr}-12-31`;
        const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}&account=${encodeURIComponent(account)}`);
        const items = resp.ok ? await resp.json() : [];
        yrLogs = Array.isArray(items) ? items : [];
        setYearCache((prev)=> ({ ...prev, [yr]: yrLogs! }));
      } catch { yrLogs = []; }
    }
    const done = (yrLogs || []).filter((x)=> x.type === l.type && String(x.grade).toLowerCase() === l.grade.toLowerCase()).length;
    const goal = (goals || []).find((g)=> g.year === yr && g.type === l.type && String(g.grade).toLowerCase() === l.grade.toLowerCase());
    const target = goal?.target || 0;
    return { yr, done, target };
  }

  // Create a transparent PNG overlay for a log with progress
  async function createLogOverlay(l: { id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }) {
    try {
      const dateISO = String(l.date).slice(0,10);
      const { yr, done, target } = await getProgressForLog({ ...l, date: dateISO });
      const W = 1080, H = 1920; const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.clearRect(0,0,W,H);
      const accent = '#fc4c02';
      ctx.textAlign = 'center';
      const write = (text: string, size: number, px: number, py: number, bold=false, color='#ffffff') => {
        ctx.font = `${bold? '700' : '400'} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillStyle = color; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3; ctx.fillText(text, px, py);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      };
      const writePair = (label: string, value: string, size: number, y: number) => {
        const space = 14;
        ctx.font = `400 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
        const labelW = ctx.measureText(label + ': ').width;
        ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
        const valueW = ctx.measureText(value).width;
        const totalW = labelW + space + valueW;
        const startX = cx - totalW / 2;
        ctx.textAlign = 'left';
        ctx.font = `400 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
        ctx.fillText(label + ':', startX, y);
        ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillStyle = accent;
        ctx.fillText(value, startX + labelW + space, y);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.textAlign = 'center';
      };
      const cx = W/2, padY = 160;
      const gradeText = String(l.grade || '').toUpperCase();
      write(`${gradeText} SENT!`, 96, cx, padY, true, accent);
      // Hero progress directly after title
      write(`${done}/${target || '—'}`, 140, cx, padY+120, true, accent);
      write(`${dateISO} • Session ${l.session}`, 48, cx, padY+220);
      writePair('Attempts', l.attempts===0? 'Flash' : String(l.attempts), 44, padY+300);
      if (l.location) writePair('Location', l.location, 44, padY+350);
      // moved above under title
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `climb-${l.id}.png`; a.click();
        setTimeout(()=> URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (e) { /* no-op */ }
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
              <div className="flex items-center gap-2">
                <button className="btn-outline text-xs" onClick={()=>createLogOverlay(l)}>Overlay</button>
                <button className="btn-outline text-xs" onClick={()=>removeLog(l.id)}>Delete</button>
              </div>
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
        onPrev={()=>{ if (allPage>1) { refreshAll(allPage-1); } }}
        onNext={()=>{ const maxPage = Math.max(1, Math.ceil(allTotal / allLimit)); if (allPage < maxPage) { refreshAll(allPage+1); } }}
        onDelete={(id)=>{ removeLog(id); }}
        onOverlay={(l)=>{ createLogOverlay(l); }}
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

function AllLogsCard({ items, total, page, limit, loading, onPrev, onNext, onDelete, onOverlay }:{ items: Array<{ id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string }>; total: number; page: number; limit: number; loading: boolean; onPrev: ()=>void; onNext: ()=>void; onDelete: (id: string)=>void; onOverlay: (l: { id: string; date: string; session: number; type: 'boulder'|'rope'; grade: string; attempts: number; location?: string; notes?: string })=>void }) {
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
                <td className="py-1 pr-2 text-right"><button className="btn-outline text-xs" onClick={()=>onOverlay(l)}>Overlay</button></td>
                <td className="py-1 pr-2 text-right"><button className="btn-outline text-xs" onClick={()=>onDelete(l.id)}>Delete</button></td>
              </tr>
            ))}
            {items.length===0 && (
              <tr><td colSpan={9} className="py-3 text-center subtle">{loading? 'Loading…' : 'No logs found'}</td></tr>
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
