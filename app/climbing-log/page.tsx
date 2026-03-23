"use client";

import { useEffect, useRef, useState } from 'react';
import { parseCookies } from '@/lib/apiHelpers';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) { const [y, m, d] = s.split('-').map((x) => parseInt(x, 10)); return new Date(y, (m || 1) - 1, d || 1); }

export default function ClimbingLogPage() {
  const today = localTodayISO();
  const [account, setAccount] = useState<string>('Alex');
  const [date, setDate] = useState<string>(today);
  const [session, setSession] = useState<number>(1);
  const [type, setType] = useState<'boulder' | 'rope'>('boulder');
  const [grade, setGrade] = useState<string>('V4');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(1);
  const [flash, setFlash] = useState<boolean>(false);
  const [logs, setLogs] = useState<Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  // All logs pagination
  const [allPage, setAllPage] = useState<number>(1);
  const allLimit = 10;
  const [allItems, setAllItems] = useState<Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>>([]);
  const [allTotal, setAllTotal] = useState<number>(0);
  const [allLoading, setAllLoading] = useState<boolean>(false);
  // Goals and per-year logs cache for overlay progress
  const [goals, setGoals] = useState<Array<{ id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number }>>([]);
  const [yearCache, setYearCache] = useState<Record<number, Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>>>({});
  // Set Goal form
  const [goalForm, setGoalForm] = useState<{ year: number; type: 'boulder' | 'rope'; grade: string; target: number }>({ year: new Date().getFullYear(), type: 'boulder', grade: 'V4', target: 100 });

  useEffect(() => {
    const cookieAccount = (() => { try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; } })();
    const init = cookieAccount || (typeof window !== 'undefined' ? localStorage.getItem('account') : null);
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    const onAccountChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const cookieAcc = (() => { try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; } })();
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
  useEffect(() => { (async () => { try { const gRes = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch { } })(); }, [account]);

  async function addLog() {
    const body = { date, session, type, grade: grade.trim(), attempts: flash ? 0 : attempts, location: location.trim(), notes: notes.trim() };
    const res = await fetch(`/api/climbing/logs?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setGrade(type === 'boulder' ? 'V4' : '6a'); setAttempts(1); setFlash(false); setLocation(''); setNotes(''); refresh(); }
  }

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}&account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
    refreshAll(allPage);
  }

  // Compute ordinal/target for a given log (type+grade in log's year), fetching year logs if needed
  async function getProgressForLog(l: { id?: string; date: string; type: 'boulder' | 'rope'; grade: string }) {
    const yr = parseLocalDate(l.date).getFullYear();
    let yrLogs = yearCache[yr];
    if (!yrLogs) {
      try {
        const yrStart = `${yr}-01-01`; const yrEnd = `${yr}-12-31`;
        const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}&account=${encodeURIComponent(account)}`);
        const items = resp.ok ? await resp.json() : [];
        yrLogs = Array.isArray(items) ? items : [];
        setYearCache((prev) => ({ ...prev, [yr]: yrLogs! }));
      } catch { yrLogs = []; }
    }
    const same = (yrLogs || [])
      .filter((x) => x.type === l.type && String(x.grade).toLowerCase() === l.grade.toLowerCase())
      .slice()
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
    // Determine ordinal position for this log within the year's same-grade entries
    let ordinal = 0;
    if (l.id) {
      const idx = same.findIndex((x) => x.id === l.id);
      if (idx >= 0) {
        ordinal = idx + 1;
      } else {
        const cutoff = parseLocalDate(l.date).getTime();
        ordinal = same.filter((x) => parseLocalDate(x.date).getTime() <= cutoff).length;
      }
    } else {
      const cutoff = parseLocalDate(l.date).getTime();
      ordinal = same.filter((x) => parseLocalDate(x.date).getTime() <= cutoff).length;
    }
    if (ordinal <= 0) ordinal = same.length; // fallback to total if not found
    const goal = (goals || []).find((g) => g.year === yr && g.type === l.type && String(g.grade).toLowerCase() === l.grade.toLowerCase());
    const target = goal?.target || 0;
    return { yr, ordinal, target };
  }

  // Create a transparent PNG overlay for a log with goal meter and fraction progress
  async function createLogOverlay(l: { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }) {
    try {
      const dateISO = String(l.date).slice(0, 10);
      const { yr, ordinal, target } = await getProgressForLog({ ...l, date: dateISO });
      const W = 1080, H = 1920;
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // Transparent background, match goal overlay style
      const accent = '#fc4c02';
      const fg = '#ffffff';
      ctx.textAlign = 'left';
      const write = (text: string, size: number, px: number, py: number, bold = false, color = fg, shadow = true) => {
        ctx.font = `${bold ? '700' : '400'} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillStyle = color;
        if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3; }
        ctx.fillText(text, px, py);
        if (shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
      };

      // Compute percent
      const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;

      // Layout (mirror goal overlay) with centered group and improved spacing
      const labelSize = 54;
      const labelGap = 10;
      const leftLabelW = 340;   // left stacked labels width
      const labelPad = 24;      // gap between left labels and meter
      const percentW = 96;      // right area for percent
      const meterH = labelSize * 2 + labelGap; // meter height equals stacked labels
      const padX = 96;          // symmetric horizontal padding
      // Compute meter width inside padded area
      const meterW = Math.max(520, W - padX * 2 - leftLabelW - percentW - labelPad);
      const meterX = Math.round(W / 2 - meterW / 2); // center the meter itself under title
      const groupX = meterX - leftLabelW - labelPad; // left labels align to the left of the centered meter
      // Vertically center meter block with room for title above and details below
      const meterTop = Math.round(H / 2 - meterH / 2 - 40);

      // Single meter bar
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(meterX, meterTop, meterW, meterH);
      const fillW = Math.max(0, Math.min(meterW, Math.round(meterW * (Math.max(0, Math.min(100, pct)) / 100))));
      ctx.fillStyle = accent;
      ctx.fillRect(meterX, meterTop, fillW, meterH);

      // Value text centered within bar
      ctx.textAlign = 'center';
      write(`${ordinal}/${target || '—'}`, 40, meterX + meterW / 2, meterTop + meterH / 2 + 18, true);

      // Left stacked labels (right-aligned within leftLabelW area)
      ctx.textAlign = 'right';
      write(`${yr}`, labelSize, groupX + leftLabelW, meterTop + labelSize, true);
      const goalLabel = `${String(l.grade).toUpperCase()} GOAL`;
      write(goalLabel, labelSize, groupX + leftLabelW, meterTop + labelSize + labelGap + labelSize, true);

      // Percent on the right of the meter, left-aligned
      ctx.textAlign = 'left';
      write(`${pct}%`, 120, meterX + meterW + 16, meterTop + meterH / 2 + 40, true, accent);

      // Top title: Vx SENT!
      ctx.textAlign = 'center';
      const titleY = meterTop - 48; // place title just above the meter, slightly closer
      write(`${String(l.grade).toUpperCase()} SENT!`, 88, W / 2, titleY, true, accent);

      // Bottom details: Sessions N - Attempts M (no date/location)
      const bottomY = meterTop + meterH + 110; // align closer while staying readable
      const attemptsText = l.attempts === 0 ? 'Flash' : String(l.attempts);
      write(`Sessions ${l.session} - Attempts ${attemptsText}`, 56, W / 2, bottomY, true);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `climb-${l.id}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (e) { /* no-op */ }
  }

  const boulderGrades = Array.from({ length: 13 }, (_, i) => `V${i}`);
  const frenchGrades = ['5a', '5a+', '5b', '5b+', '5c', '5c+', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c'];

  async function saveGoal() {
    const res = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalForm) });
    if (res.ok) {/* no-op */ }
  }

  return (
    <section className="mx-auto max-w-5xl px-3 py-4 sm:px-4 space-y-6">
      <h2 className="text-xl font-semibold">Climbing Log</h2>
      <div className="card p-4 space-y-4">
        <div className="font-medium" style={{ color: 'var(--muted-foreground)' }}>Add Entry</div>
        <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-start">
              <input type="date" className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="number" min={1} className="input w-full" value={session} onChange={(e) => setSession(parseInt(e.target.value || '1', 10) || 1)} placeholder="Session #" />
              <select className="input w-full" value={type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setType(t); setGrade(t === 'boulder' ? 'V4' : '6a'); }}>
                <option value="boulder">Boulder</option>
                <option value="rope">Rope</option>
              </select>
              <select className="input w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {(type === 'boulder' ? boulderGrades : frenchGrades).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input className="input w-full" placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
              <input className="input w-full" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex items-center gap-2">
                <input type="number" min={0} className="input w-full" value={flash ? 0 : attempts} onChange={(e) => { setFlash(false); setAttempts(parseInt(e.target.value || '0', 10) || 0); }} placeholder="Attempts" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flash} onChange={(e) => { setFlash(e.target.checked); if (e.target.checked) setAttempts(0); }} /> Flash</label>
              </div>
              <button className="btn w-full sm:w-auto" onClick={addLog}>Add</button>
            </div>
          </div>
        {logs.length > 0 && (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-alt)' }}>
                <div className="text-sm">
                  <span className="font-medium" style={{ color: 'var(--accent)' }}>{l.grade}</span>
                  {' '}· S{l.session} · {l.type} · {l.attempts === 0 ? 'flash' : `${l.attempts} att`}{l.location ? ` · ${l.location}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-outline text-xs" onClick={() => createLogOverlay(l)}>Overlay</button>
                  <button className="btn-outline text-xs" onClick={() => removeLog(l.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {logs.length === 0 && <div className="subtle text-sm">No climbs logged for this day.</div>}
      </div>

      <AllLogsCard
        items={allItems}
        total={allTotal}
        page={allPage}
        limit={allLimit}
        loading={allLoading}
        onPrev={() => { if (allPage > 1) { refreshAll(allPage - 1); } }}
        onNext={() => { const maxPage = Math.max(1, Math.ceil(allTotal / allLimit)); if (allPage < maxPage) { refreshAll(allPage + 1); } }}
        onDelete={(id) => { removeLog(id); }}
        onOverlay={(l) => { createLogOverlay(l); }}
      />
      <div className="card p-4 space-y-3">
        <div className="font-medium">Set Goal</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input type="number" className="input" value={goalForm.year} onChange={(e) => setGoalForm({ ...goalForm, year: parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear() })} />
          <select className="input" value={goalForm.type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setGoalForm({ ...goalForm, type: t, grade: t === 'boulder' ? 'V4' : '6a' }); }}>
            <option value="boulder">Boulder</option>
            <option value="rope">Rope</option>
          </select>
          <select className="input" value={goalForm.grade} onChange={(e) => setGoalForm({ ...goalForm, grade: e.target.value })}>
            {(goalForm.type === 'boulder' ? boulderGrades : frenchGrades).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <input type="number" min={1} className="input" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: parseInt(e.target.value || '1', 10) || 1 })} />
        </div>
        <div><button className="btn" onClick={saveGoal}>Save Goal</button></div>
      </div>
    </section>
  );
}

function AllLogsCard({ items, total, page, limit, loading, onPrev, onNext, onDelete, onOverlay }: { items: Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>; total: number; page: number; limit: number; loading: boolean; onPrev: () => void; onNext: () => void; onDelete: (id: string) => void; onOverlay: (l: { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }) => void }) {
  const maxPage = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">All Logs</div>
        <div className="subtle text-xs">Page {page} of {maxPage} · {total} total</div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="subtle text-xs uppercase tracking-wider text-left" style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">S#</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">Grade</th>
              <th className="pb-2 pr-3 font-medium">Attempts</th>
              <th className="pb-2 pr-3 font-medium">Location</th>
              <th className="pb-2 pr-3 font-medium">Notes</th>
              <th className="pb-2 pr-3"></th>
              <th className="pb-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 === 1 ? 'var(--surface-alt)' : undefined }}>
                <td className="py-1.5 pr-3 whitespace-nowrap">{l.date.slice(0, 10)}</td>
                <td className="py-1.5 pr-3">{l.session}</td>
                <td className="py-1.5 pr-3 capitalize">{l.type}</td>
                <td className="py-1.5 pr-3 font-medium" style={{ color: 'var(--accent)' }}>{l.grade}</td>
                <td className="py-1.5 pr-3">{l.attempts === 0 ? 'flash' : l.attempts}</td>
                <td className="py-1.5 pr-3">{l.location || ''}</td>
                <td className="py-1.5 pr-3 max-w-[20rem] truncate subtle" title={l.notes || ''}>{l.notes || ''}</td>
                <td className="py-1.5 pr-1 text-right"><button className="btn-outline text-xs" onClick={() => onOverlay(l)}>Overlay</button></td>
                <td className="py-1.5 text-right"><button className="btn-outline text-xs" onClick={() => onDelete(l.id)}>Delete</button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} className="py-4 text-center subtle text-sm">{loading ? 'Loading…' : 'No logs found'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button className="btn-outline text-sm" disabled={page <= 1} onClick={onPrev}>← Previous</button>
        <button className="btn-outline text-sm" disabled={page >= maxPage} onClick={onNext}>Next →</button>
      </div>
    </div>
  );
}
