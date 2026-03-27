"use client";

import { parseCookies } from '@/lib/apiHelpers';
import { useEffect, useRef, useState } from 'react';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) { const [y, m, d] = s.split('-').map((x) => parseInt(x, 10)); return new Date(y, (m || 1) - 1, d || 1); }

type LogEntry = { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string };
type GoalEntry = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  const [allPage, setAllPage] = useState<number>(1);
  const allLimit = 10;
  const [allItems, setAllItems] = useState<LogEntry[]>([]);
  const [allTotal, setAllTotal] = useState<number>(0);
  const [allLoading, setAllLoading] = useState<boolean>(false);
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [yearCache, setYearCache] = useState<Record<number, LogEntry[]>>({});
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

  useEffect(() => { (async () => { try { const gRes = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch { } })(); }, [account]);

  async function addLog() {
    const body = { date, session, type, grade: grade.trim(), attempts: flash ? 0 : attempts, location: location.trim(), notes: notes.trim() };
    const res = await fetch(`/api/climbing/logs?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setGrade(type === 'boulder' ? 'V4' : '6a'); setAttempts(1); setFlash(false); setLocation(''); setNotes(''); refresh(); refreshAll(allPage); }
  }

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}&account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
    refreshAll(allPage);
  }

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
    let ordinal = 0;
    if (l.id) {
      const idx = same.findIndex((x) => x.id === l.id);
      if (idx >= 0) { ordinal = idx + 1; } else {
        const cutoff = parseLocalDate(l.date).getTime();
        ordinal = same.filter((x) => parseLocalDate(x.date).getTime() <= cutoff).length;
      }
    } else {
      const cutoff = parseLocalDate(l.date).getTime();
      ordinal = same.filter((x) => parseLocalDate(x.date).getTime() <= cutoff).length;
    }
    if (ordinal <= 0) ordinal = same.length;
    const goal = (goals || []).find((g) => g.year === yr && g.type === l.type && String(g.grade).toLowerCase() === l.grade.toLowerCase());
    const target = goal?.target || 0;
    return { yr, ordinal, target };
  }

  // Strava-style overlay with circular progress ring
  async function createLogOverlay(l: LogEntry) {
    try {
      const dateISO = String(l.date).slice(0, 10);
      const { yr, ordinal, target } = await getProgressForLog({ ...l, date: dateISO });
      const W = 1080, H = 1920;
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const c = canvas.getContext('2d'); if (!c) return;
      c.clearRect(0, 0, W, H);

      const font = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
      const accent = '#fc4c02';
      const green = '#22c55e';
      const muted = 'rgba(255,255,255,0.6)';
      const shadow = () => { c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 12; c.shadowOffsetY = 4; };
      const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };
      const write = (text: string, size: number, x: number, y: number, opts: { bold?: boolean; color?: string; align?: CanvasTextAlign } = {}) => {
        c.font = `${opts.bold ? '700' : '400'} ${size}px ${font}`;
        c.fillStyle = opts.color || '#ffffff';
        c.textAlign = opts.align || 'center';
        shadow(); c.fillText(text, x, y); noShadow();
      };

      const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
      const cx = W / 2;

      // ── Bottom-half layout ──
      const baseY = H * 0.40;

      // Grade badge at top
      const badgeText = l.grade.toUpperCase();
      c.font = `700 64px ${font}`;
      const badgeW = c.measureText(badgeText).width + 80;
      const badgeH = 88;
      const badgeX = cx - badgeW / 2;
      const badgeY = baseY - 20;

      // Badge pill
      shadow();
      c.beginPath();
      const br = 20;
      c.roundRect(badgeX, badgeY, badgeW, badgeH, br);
      c.fillStyle = accent;
      c.fill();
      noShadow();
      // Badge text
      c.textAlign = 'center';
      c.font = `700 64px ${font}`;
      c.fillStyle = '#ffffff';
      c.fillText(badgeText, cx, badgeY + 62);

      // "SENT!" below badge
      write('SENT!', 36, cx, badgeY + badgeH + 50, { bold: true, color: muted });

      // Progress ring
      const ringY = badgeY + badgeH + 180;
      const ringR = 120;
      // Background ring
      c.beginPath(); c.arc(cx, ringY, ringR, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 18; c.stroke();
      // Progress arc
      const startAngle = -Math.PI / 2;
      shadow();
      c.beginPath(); c.arc(cx, ringY, ringR, startAngle, startAngle + Math.PI * 2 * Math.min(1, pct / 100));
      c.strokeStyle = pct >= 100 ? green : accent;
      c.lineWidth = 18; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
      noShadow();

      // Fraction inside ring
      write(`${ordinal}`, 72, cx, ringY + 10, { bold: true });
      if (target > 0) {
        write(`/ ${target}`, 32, cx, ringY + 50, { color: muted });
      }

      // Percent below ring
      if (target > 0) {
        write(`${pct}%`, 48, cx, ringY + ringR + 60, { bold: true, color: accent });
      }

      // Stats row below
      const statsY = ringY + ringR + (target > 0 ? 130 : 60);
      const statsData = [
        { label: 'TYPE', value: l.type === 'boulder' ? 'Boulder' : 'Rope' },
        { label: 'SESSION', value: `#${l.session}` },
        { label: 'ATTEMPTS', value: l.attempts === 0 ? 'Flash ⚡' : String(l.attempts) },
      ];
      const statSpacing = W / (statsData.length + 1);
      statsData.forEach((s, i) => {
        const sx = statSpacing * (i + 1);
        write(s.value, 44, sx, statsY, { bold: true });
        write(s.label, 20, sx, statsY + 34, { color: muted });
      });

      // Location & date at bottom
      const bottomY = statsY + 100;
      const dateFormatted = parseLocalDate(dateISO).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const bottomLine = l.location ? `${l.location} · ${dateFormatted}` : dateFormatted;
      write(bottomLine, 28, cx, bottomY, { color: muted });

      // Year goal context
      if (target > 0) {
        write(`${yr} GOAL`, 22, cx, bottomY + 40, { color: 'rgba(255,255,255,0.4)' });
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `climb-${l.id}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch { /* no-op */ }
  }

  const boulderGrades = Array.from({ length: 13 }, (_, i) => `V${i}`);
  const frenchGrades = ['5a', '5a+', '5b', '5b+', '5c', '5c+', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c'];

  async function saveGoal() {
    const res = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalForm) });
    if (res.ok) { /* refresh goals */ try { const gRes = await fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch { } }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Climbing Log</h2>

      {/* ── Add Entry ── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>Add Entry</span>
        </div>

        {/* Row 1: Date, Session, Type */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Date</label>
            <input type="date" className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Session</label>
            <input type="number" min={1} className="input w-full" value={session} onChange={(e) => setSession(parseInt(e.target.value || '1', 10) || 1)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Type</label>
            <select className="input w-full" value={type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setType(t); setGrade(t === 'boulder' ? 'V4' : '6a'); }}>
              <option value="boulder">Boulder</option>
              <option value="rope">Rope</option>
            </select>
          </div>
        </div>

        {/* Row 2: Grade, Attempts/Flash */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Grade</label>
            <select className="input w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
              {(type === 'boulder' ? boulderGrades : frenchGrades).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Attempts</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} className="input w-full" value={flash ? 0 : attempts} onChange={(e) => { setFlash(false); setAttempts(parseInt(e.target.value || '0', 10) || 0); }} />
              <button
                onClick={() => { setFlash(!flash); if (!flash) setAttempts(0); }}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition"
                style={{
                  background: flash ? 'var(--accent)' : 'var(--surface-alt)',
                  color: flash ? '#fff' : 'var(--text)',
                  border: `1px solid ${flash ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                ⚡ Flash
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Location, Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Location</label>
            <input className="input w-full" placeholder="Optional" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Notes</label>
            <input className="input w-full" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <button className="btn w-full sm:w-auto" onClick={addLog}>Log Send</button>

        {/* Today's logs */}
        {logs.length > 0 && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Today&apos;s Sends ({logs.length})
            </div>
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-alt)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>{l.grade}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      S{l.session} · {l.type === 'boulder' ? 'Boulder' : 'Rope'}
                      {l.attempts === 0 ? ' · ⚡ Flash' : ` · ${l.attempts} att`}
                    </div>
                    {l.location && <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{l.location}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="btn-outline text-xs px-2.5 py-1.5" onClick={() => createLogOverlay(l)}>📸</button>
                  <button className="btn-outline text-xs px-2.5 py-1.5" onClick={() => removeLog(l.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {logs.length === 0 && <div className="subtle text-sm">No climbs logged for this day.</div>}
      </div>

      {/* ── All Logs ── */}
      <AllLogsCard
        items={allItems}
        total={allTotal}
        page={allPage}
        limit={allLimit}
        loading={allLoading}
        onPrev={() => { if (allPage > 1) refreshAll(allPage - 1); }}
        onNext={() => { const maxPage = Math.max(1, Math.ceil(allTotal / allLimit)); if (allPage < maxPage) refreshAll(allPage + 1); }}
        onDelete={(id) => removeLog(id)}
        onOverlay={(l) => createLogOverlay(l)}
      />

      {/* ── Set Goal ── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>Set Goal</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Year</label>
            <input type="number" className="input w-full" value={goalForm.year} onChange={(e) => setGoalForm({ ...goalForm, year: parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear() })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Type</label>
            <select className="input w-full" value={goalForm.type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setGoalForm({ ...goalForm, type: t, grade: t === 'boulder' ? 'V4' : '6a' }); }}>
              <option value="boulder">Boulder</option>
              <option value="rope">Rope</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Grade</label>
            <select className="input w-full" value={goalForm.grade} onChange={(e) => setGoalForm({ ...goalForm, grade: e.target.value })}>
              {(goalForm.type === 'boulder' ? boulderGrades : frenchGrades).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Target</label>
            <input type="number" min={1} className="input w-full" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: parseInt(e.target.value || '1', 10) || 1 })} />
          </div>
        </div>
        <button className="btn w-full sm:w-auto" onClick={saveGoal}>Save Goal</button>

        {/* Show current goals */}
        {goals.length > 0 && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Active Goals</div>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <span key={g.id} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--surface-alt)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                  {g.year} · {g.grade.toUpperCase()} × {g.target}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AllLogsCard({ items, total, page, limit, loading, onPrev, onNext, onDelete, onOverlay }: {
  items: LogEntry[];
  total: number; page: number; limit: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
  onDelete: (id: string) => void;
  onOverlay: (l: LogEntry) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm">All Logs</span>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{total} total · Page {page}/{maxPage}</span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-left" style={{ color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Grade</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">S#</th>
              <th className="pb-2 pr-3 font-medium">Att.</th>
              <th className="pb-2 pr-3 font-medium">Location</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 === 1 ? 'var(--surface-alt)' : undefined }}>
                <td className="py-2 pr-3 whitespace-nowrap">{l.date.slice(0, 10)}</td>
                <td className="py-2 pr-3 font-bold" style={{ color: 'var(--accent)' }}>{l.grade}</td>
                <td className="py-2 pr-3 capitalize">{l.type}</td>
                <td className="py-2 pr-3">{l.session}</td>
                <td className="py-2 pr-3">{l.attempts === 0 ? '⚡' : l.attempts}</td>
                <td className="py-2 pr-3 max-w-[12rem] truncate" style={{ color: 'var(--muted-foreground)' }}>{l.location || '—'}</td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button className="btn-outline text-xs px-2 py-1" onClick={() => onOverlay(l)}>📸</button>
                    <button className="btn-outline text-xs px-2 py-1" onClick={() => onDelete(l.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>{loading ? 'Loading...' : 'No logs found'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && (
          <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>{loading ? 'Loading...' : 'No logs found'}</div>
        )}
        {items.map((l) => (
          <div key={l.id} className="rounded-xl px-3 py-3" style={{ background: 'var(--surface-alt)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>{l.grade}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {l.type === 'boulder' ? 'Boulder' : 'Rope'} · S{l.session}
                    {l.attempts === 0 ? ' · ⚡' : ` · ${l.attempts} att`}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {l.date.slice(0, 10)}{l.location ? ` · ${l.location}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button className="btn-outline text-xs px-2 py-1.5" onClick={() => onOverlay(l)}>📸</button>
                <button className="btn-outline text-xs px-2 py-1.5" onClick={() => onDelete(l.id)}>✕</button>
              </div>
            </div>
            {l.notes && <div className="mt-1.5 text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{l.notes}</div>}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-1">
          <button className="btn-outline text-sm px-3 py-1.5" disabled={page <= 1} onClick={onPrev}>← Prev</button>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{page} / {maxPage}</span>
          <button className="btn-outline text-sm px-3 py-1.5" disabled={page >= maxPage} onClick={onNext}>Next →</button>
        </div>
      )}
    </div>
  );
}
