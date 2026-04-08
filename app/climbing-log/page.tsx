"use client";

import { useEffect, useRef, useState } from 'react';
import { pad, localTodayISO, parseLocalDate } from '@/lib/date';
import { DEFAULT_BOULDER_GRADE, DEFAULT_ROPE_GRADE, BOULDER_GRADES, FRENCH_GRADES } from '@/lib/climbing';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

type LogEntry = { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string };
type GoalEntry = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

export default function ClimbingLogPage() {
  const today = localTodayISO();
  const [date, setDate] = useState<string>(today);
  const [session, setSession] = useState<number>(1);
  const [type, setType] = useState<'boulder' | 'rope'>('boulder');
  const [grade, setGrade] = useState<string>(DEFAULT_BOULDER_GRADE);
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
  const [goalForm, setGoalForm] = useState<{ year: number; type: 'boulder' | 'rope'; grade: string; target: number }>({ year: new Date().getFullYear(), type: 'boulder', grade: DEFAULT_BOULDER_GRADE, target: 100 });
  const [adding, setAdding] = useState(false);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();
      const res = await fetch(`/api/climbing/logs?date=${date}`, { signal: ctrlRef.current.signal });
      const items = res.ok ? await res.json() : [];
      setLogs(Array.isArray(items) ? items : []);
    } catch { setLogs([]); }
  }

  useEffect(() => { refresh(); }, [date]);

  async function refreshAll(page = 1) {
    setAllLoading(true);
    try {
      const res = await fetch(`/api/climbing/logs?limit=${allLimit}&page=${page}`);
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

  useEffect(() => { refreshAll(1); }, []);

  useEffect(() => { (async () => { try { const gRes = await fetch('/api/climbing/goals'); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch { } })(); }, []);

  async function addLog() {
    setAdding(true);
    try {
      const body = { date, session, type, grade: grade.trim(), attempts: flash ? 0 : attempts, location: location.trim(), notes: notes.trim() };
      const res = await fetch('/api/climbing/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setGrade(type === 'boulder' ? DEFAULT_BOULDER_GRADE : DEFAULT_ROPE_GRADE); setAttempts(1); setFlash(false); setLocation(''); setNotes(''); refresh(); refreshAll(allPage); }
    } finally { setAdding(false); }
  }

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    refresh();
    refreshAll(allPage);
  }

  async function getProgressForLog(l: { id?: string; date: string; type: 'boulder' | 'rope'; grade: string }) {
    const yr = parseLocalDate(l.date).getFullYear();
    let yrLogs = yearCache[yr];
    if (!yrLogs) {
      try {
        const yrStart = `${yr}-01-01`; const yrEnd = `${yr}-12-31`;
        const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}`);
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

  // Overlay version picker state
  const [overlayMenu, setOverlayMenu] = useState<{ log: LogEntry; x: number; y: number } | null>(null);
  const overlayMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayMenu) return;
    const close = (e: MouseEvent) => { if (overlayMenuRef.current && !overlayMenuRef.current.contains(e.target as Node)) setOverlayMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [overlayMenu]);

  function showOverlayMenu(l: LogEntry, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setOverlayMenu({ log: l, x: rect.left, y: rect.bottom + 4 });
  }

  // Shared canvas setup
  function createOverlayCanvas() {
    const W = CANVAS_WIDTH, H = CANVAS_HEIGHT;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    const font = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
    const accent = '#fc4c02';
    const green = '#22c55e';
    const muted = '#ffffff';
    const dim = 'rgba(255,255,255,0.85)';
    const shadow = () => { c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 28; c.shadowOffsetX = 0; c.shadowOffsetY = 2; };
    const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };
    // write draws text twice for extra shadow punch on bright backgrounds
    const write = (text: string, size: number, x: number, y: number, opts: { bold?: boolean; color?: string; align?: CanvasTextAlign } = {}) => {
      c.font = `${opts.bold ? '700' : '400'} ${size}px ${font}`;
      c.fillStyle = opts.color || '#ffffff';
      c.textAlign = opts.align || 'center';
      shadow(); c.fillText(text, x, y); c.fillText(text, x, y); noShadow();
    };
    const download = (name: string) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    };
    const drawBadge = (text: string, y: number) => {
      c.font = `700 72px ${font}`;
      const bw = c.measureText(text).width + 90;
      const bh = 96;
      shadow();
      c.beginPath(); c.roundRect(W / 2 - bw / 2, y, bw, bh, 22);
      c.fillStyle = accent; c.fill(); noShadow();
      c.textAlign = 'center'; c.font = `700 72px ${font}`; c.fillStyle = '#fff';
      shadow(); c.fillText(text, W / 2, y + 68); noShadow();
      return { bw, bh };
    };
    const drawMeter = (x: number, y: number, w: number, h: number, pct: number) => {
      const r = h / 2;
      c.beginPath(); c.roundRect(x, y, w, h, r);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill();
      const fw = Math.max(h, Math.round(w * Math.min(1, pct / 100)));
      shadow();
      c.beginPath(); c.roundRect(x, y, fw, h, r);
      c.fillStyle = pct >= 100 ? green : accent; c.fill();
      noShadow();
    };
    return { canvas, c, W, H, write, accent, green, muted, dim, font, shadow, noShadow, download, drawBadge, drawMeter };
  }

  // Version 1: Centered — badge + meter + stats
  async function createOverlayV1(l: LogEntry) {
    try {
      const dateISO = String(l.date).slice(0, 10);
      const { yr, ordinal, target } = await getProgressForLog({ ...l, date: dateISO });
      const { W, H, write, accent, muted, dim, download, drawBadge, drawMeter } = createOverlayCanvas();
      const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
      const cx = W / 2;
      const padX = 100;

      const baseY = H * 0.42;
      const { bh } = drawBadge(l.grade.toUpperCase(), baseY);

      write('SENT!', 40, cx, baseY + bh + 56, { bold: true, color: muted });

      // Meter
      const meterY = baseY + bh + 120;
      const meterW = W - padX * 2;
      const meterH = 40;
      drawMeter(padX, meterY, meterW, meterH, pct);

      if (target > 0) {
        write(`${ordinal} / ${target}`, 64, padX, meterY - 16, { bold: true, align: 'left' });
        write(`${pct}%`, 64, W - padX, meterY - 16, { bold: true, color: accent, align: 'right' });
        write(`${yr} GOAL`, 26, cx, meterY + meterH + 40, { color: dim });
      } else {
        write(`Send #${ordinal}`, 52, padX, meterY - 16, { bold: true, align: 'left' });
      }

      // Stats
      const statsY = meterY + meterH + (target > 0 ? 110 : 70);
      const stats = [
        { label: 'TYPE', value: l.type === 'boulder' ? 'Boulder' : 'Rope' },
        { label: 'SESSION', value: `#${l.session}` },
        { label: 'ATTEMPTS', value: l.attempts === 0 ? 'Flash' : String(l.attempts) },
      ];
      const sp = W / (stats.length + 1);
      stats.forEach((s, i) => {
        write(s.value, 48, sp * (i + 1), statsY, { bold: true });
        write(s.label, 22, sp * (i + 1), statsY + 38, { color: muted });
      });

      download(`climb-${l.id}.png`);
    } catch { /* no-op */ }
  }

  // Version 2: Compact bottom — everything at the very bottom, minimal
  async function createOverlayV2(l: LogEntry) {
    try {
      const dateISO = String(l.date).slice(0, 10);
      const { yr, ordinal, target } = await getProgressForLog({ ...l, date: dateISO });
      const { W, H, write, accent, muted, dim, download, drawMeter } = createOverlayCanvas();
      const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
      const padX = 80;

      // Everything anchored to bottom
      const bottomBase = H - 200;

      // Grade big text
      write(l.grade.toUpperCase(), 120, padX, bottomBase - 180, { bold: true, color: accent, align: 'left' });
      write('SENT', 48, padX, bottomBase - 110, { bold: true, align: 'left' });

      // Meter
      const meterW = W - padX * 2;
      drawMeter(padX, bottomBase - 50, meterW, 32, pct);

      if (target > 0) {
        write(`${ordinal}/${target}`, 56, padX, bottomBase + 18, { bold: true, align: 'left' });
        write(`${pct}%`, 56, W - padX, bottomBase + 18, { bold: true, color: accent, align: 'right' });
      }

      // Inline stats
      const inlineY = bottomBase + 60;
      const attText = l.attempts === 0 ? 'Flash' : `${l.attempts} att`;
      const typeName = l.type === 'boulder' ? 'Boulder' : 'Rope';
      write(`${typeName}  ·  S${l.session}  ·  ${attText}`, 28, padX, inlineY, { color: muted, align: 'left' });

      if (target > 0) {
        write(`${yr} Goal`, 22, W - padX, inlineY, { color: dim, align: 'right' });
      }

      download(`climb-${l.id}-compact.png`);
    } catch { /* no-op */ }
  }

  // Version 3: Left-aligned bold — large grade hero with side stats
  async function createOverlayV3(l: LogEntry) {
    try {
      const dateISO = String(l.date).slice(0, 10);
      const { yr, ordinal, target } = await getProgressForLog({ ...l, date: dateISO });
      const { W, H, write, accent, green, muted, dim, download, drawMeter } = createOverlayCanvas();
      const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
      const padX = 100;

      const baseY = H * 0.48;

      // Huge grade left-aligned
      write(l.grade.toUpperCase(), 160, padX, baseY, { bold: true, color: accent, align: 'left' });
      write('SENT', 56, padX, baseY + 60, { bold: true, align: 'left' });

      // Stats column below
      const statsX = padX;
      const statsY = baseY + 130;
      const lineH = 70;
      const stats = [
        { label: 'Type', value: l.type === 'boulder' ? 'Boulder' : 'Rope' },
        { label: 'Session', value: `#${l.session}` },
        { label: 'Attempts', value: l.attempts === 0 ? 'Flash' : String(l.attempts) },
      ];
      stats.forEach((s, i) => {
        const sy = statsY + i * lineH;
        write(s.label.toUpperCase(), 22, statsX, sy, { color: muted, align: 'left' });
        write(s.value, 38, statsX + 220, sy, { bold: true, align: 'left' });
      });

      // Meter at bottom of stats
      if (target > 0) {
        const meterY = statsY + stats.length * lineH + 30;
        const meterW = W - padX * 2;
        drawMeter(padX, meterY, meterW, 36, pct);
        write(`${ordinal}/${target}`, 56, padX, meterY + 68, { bold: true, align: 'left' });
        write(`${pct}%`, 56, W - padX, meterY + 68, { bold: true, color: pct >= 100 ? green : accent, align: 'right' });
        write(`${yr} Goal`, 24, padX, meterY + 102, { color: dim, align: 'left' });
      }

      download(`climb-${l.id}-bold.png`);
    } catch { /* no-op */ }
  }

  const boulderGrades = BOULDER_GRADES;
  const frenchGrades = FRENCH_GRADES;

  async function saveGoal() {
    const res = await fetch('/api/climbing/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalForm) });
    if (res.ok) { /* refresh goals */ try { const gRes = await fetch('/api/climbing/goals'); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch { } }
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            <select className="input w-full" value={type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setType(t); setGrade(t === 'boulder' ? DEFAULT_BOULDER_GRADE : DEFAULT_ROPE_GRADE); }}>
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

        <button className="btn w-full sm:w-auto" onClick={addLog} disabled={adding}>{adding ? 'Saving...' : 'Log Send'}</button>

        {/* Today's logs */}
        {logs.length > 0 && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Today&apos;s Sends ({logs.length})
            </div>
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3.5" style={{ background: 'var(--surface-alt)' }}>
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>{l.grade}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      S{l.session} · {l.type === 'boulder' ? 'Boulder' : 'Rope'}
                      {l.attempts === 0 ? ' · ⚡ Flash' : ` · ${l.attempts} att`}
                    </div>
                    {l.location && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{l.location}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="btn-outline text-xs px-3 py-2" onClick={(e) => showOverlayMenu(l, e)}>Overlay</button>
                  <button className="btn-outline text-xs px-3 py-2" onClick={() => removeLog(l.id)}>✕</button>
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
        onOverlay={(l, e) => showOverlayMenu(l, e)}
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
            <select className="input w-full" value={goalForm.type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setGoalForm({ ...goalForm, type: t, grade: t === 'boulder' ? DEFAULT_BOULDER_GRADE : DEFAULT_ROPE_GRADE }); }}>
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

      {/* Overlay version picker popup */}
      {overlayMenu && (
        <div
          ref={overlayMenuRef}
          className="fixed z-50 rounded-xl p-2 shadow-lg"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            left: Math.min(overlayMenu.x, window.innerWidth - 220),
            top: Math.min(overlayMenu.y, window.innerHeight - 220),
            minWidth: 200,
          }}
        >
          <div className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Download Overlay</div>
          {[
            { label: 'Centered', desc: 'Badge + meter + stats', fn: createOverlayV1 },
            { label: 'Compact', desc: 'Bottom-anchored minimal', fn: createOverlayV2 },
            { label: 'Bold', desc: 'Large left-aligned grade', fn: createOverlayV3 },
          ].map((v) => (
            <button
              key={v.label}
              className="w-full text-left rounded-lg px-3 py-2.5 transition hover:opacity-80"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-alt)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { v.fn(overlayMenu.log); setOverlayMenu(null); }}
            >
              <div className="text-sm font-medium">{v.label}</div>
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{v.desc}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AllLogsCard({ items, total, page, limit, loading, onPrev, onNext, onDelete, onOverlay }: {
  items: LogEntry[];
  total: number; page: number; limit: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
  onDelete: (id: string) => void;
  onOverlay: (l: LogEntry, e: React.MouseEvent) => void;
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
                    <button className="btn-outline text-xs px-2 py-1" onClick={(e) => onOverlay(l, e)}>Overlay</button>
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
      <div className="sm:hidden space-y-2.5">
        {items.length === 0 && (
          <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>{loading ? 'Loading...' : 'No logs found'}</div>
        )}
        {items.map((l) => (
          <div key={l.id} className="rounded-xl px-4 py-3.5" style={{ background: 'var(--surface-alt)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>{l.grade}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {l.type === 'boulder' ? 'Boulder' : 'Rope'} · S{l.session}
                    {l.attempts === 0 ? ' · ⚡' : ` · ${l.attempts} att`}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {l.date.slice(0, 10)}{l.location ? ` · ${l.location}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="btn-outline text-xs px-3 py-2" onClick={(e) => onOverlay(l, e)}>Overlay</button>
                <button className="btn-outline text-xs px-3 py-2" onClick={() => onDelete(l.id)}>✕</button>
              </div>
            </div>
            {l.notes && <div className="mt-2 text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{l.notes}</div>}
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
