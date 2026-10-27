"use client";

import { useEffect, useRef, useState } from 'react';
import { pad, localTodayISO, parseLocalDate } from '@/lib/date';
import { DEFAULT_BOULDER_GRADE, DEFAULT_ROPE_GRADE, BOULDER_GRADES, FRENCH_GRADES } from '@/lib/climbing';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';
import { X, Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input, { Label } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ShareStorySheet from '@/components/climbing/ShareStorySheet';

type LogEntry = { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string };
type GoalEntry = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

export default function ClimbingLogView() {
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
  // "Share story" sheet: the date it opens on (null = closed)
  const [storyDate, setStoryDate] = useState<string | null>(null);
  const [storyKey, setStoryKey] = useState(0);
  // One climb's overlay when opened from a log row (null = the whole day)
  const [storyClimb, setStoryClimb] = useState<string | null>(null);
  const openStory = (d: string, climbId: string | null = null) => { setStoryKey((k) => k + 1); setStoryClimb(climbId); setStoryDate(d); };

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
        write(`${ordinal}/${target}`, 56, padX, bottomBase + 48, { bold: true, align: 'left' });
        write(`${pct}%`, 56, W - padX, bottomBase + 48, { bold: true, color: accent, align: 'right' });
      }

      // Inline stats
      const inlineY = target > 0 ? bottomBase + 110 : bottomBase + 60;
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
        write(`${ordinal}/${target}`, 56, padX, meterY + 96, { bold: true, align: 'left' });
        write(`${pct}%`, 56, W - padX, meterY + 96, { bold: true, color: pct >= 100 ? green : accent, align: 'right' });
        write(`${yr} Goal`, 24, padX, meterY + 136, { color: dim, align: 'left' });
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

  const isToday = date === today;

  return (
    <section className="space-y-3 sm:space-y-4">
      <h2 className="sr-only">Climbing log</h2>

      {/* ── Add entry: one column on a phone, primary button sticks above the tab bar ── */}
      <Card>
        <CardHeader title="Log a send" />
        <form onSubmit={(e) => { e.preventDefault(); void addLog(); }} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="cl-date">Date</Label>
              <Input id="cl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cl-session">Session</Label>
              <Input id="cl-session" type="number" min={1} inputMode="numeric" value={session} onChange={(e) => setSession(parseInt(e.target.value || '1', 10) || 1)} />
            </div>
            <div>
              <Label htmlFor="cl-type">Type</Label>
              <Select id="cl-type" className="w-full" value={type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setType(t); setGrade(t === 'boulder' ? DEFAULT_BOULDER_GRADE : DEFAULT_ROPE_GRADE); }}>
                <option value="boulder">Boulder</option>
                <option value="rope">Rope</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cl-grade">Grade</Label>
              <Select id="cl-grade" className="w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {(type === 'boulder' ? boulderGrades : frenchGrades).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cl-attempts">Attempts</Label>
              <div className="flex items-center gap-2">
                <Input id="cl-attempts" type="number" min={0} inputMode="numeric" value={flash ? 0 : attempts} onChange={(e) => { setFlash(false); setAttempts(parseInt(e.target.value || '0', 10) || 0); }} />
                <Button
                  variant={flash ? 'primary' : 'outline'}
                  aria-pressed={flash}
                  className="shrink-0"
                  onClick={() => { setFlash(!flash); if (!flash) setAttempts(0); }}
                >
                  <Zap size={16} aria-hidden="true" /> Flash
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cl-loc">Location</Label>
              <Input id="cl-loc" placeholder="Optional" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cl-notes">Notes</Label>
              <Input id="cl-notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div
            className="sticky z-30 -mx-4 border-t px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:p-0"
            style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <Button type="submit" className="w-full sm:w-auto" disabled={adding}>{adding ? 'Saving…' : 'Log send'}</Button>
          </div>
        </form>

        {/* The chosen day's logs */}
        <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>
              {isToday ? 'Today' : date} · {logs.length} send{logs.length === 1 ? '' : 's'}
            </div>
            <Button small variant="outline" onClick={() => openStory(date)}>Share story</Button>
          </div>
          {logs.length === 0 && <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No climbs logged for this day.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2" style={{ background: 'var(--surface-2)' }}>
              <div className="flex min-w-0 items-center gap-3">
                <GradeBadge grade={l.grade} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>
                    S{l.session} · {l.type === 'boulder' ? 'Boulder' : 'Rope'} · {l.attempts === 0 ? 'Flash' : `${l.attempts} att`}
                  </div>
                  {l.location && <div className="truncate text-[13px]" style={{ color: 'var(--text-2)' }}>{l.location}</div>}
                </div>
              </div>
              <RowActions onOverlay={(e) => showOverlayMenu(l, e)} onDelete={() => removeLog(l.id)} />
            </div>
          ))}
        </div>
      </Card>

      {/* ── All logs ── */}
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

      {/* ── Set goal ── */}
      <Card>
        <CardHeader title="Add a goal" />
        <form onSubmit={(e) => { e.preventDefault(); void saveGoal(); }} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="cg-year">Year</Label>
              <Input id="cg-year" type="number" inputMode="numeric" value={goalForm.year} onChange={(e) => setGoalForm({ ...goalForm, year: parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear() })} />
            </div>
            <div>
              <Label htmlFor="cg-type">Type</Label>
              <Select id="cg-type" className="w-full" value={goalForm.type} onChange={(e) => { const t = e.target.value as 'boulder' | 'rope'; setGoalForm({ ...goalForm, type: t, grade: t === 'boulder' ? DEFAULT_BOULDER_GRADE : DEFAULT_ROPE_GRADE }); }}>
                <option value="boulder">Boulder</option>
                <option value="rope">Rope</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="cg-grade">Grade</Label>
              <Select id="cg-grade" className="w-full" value={goalForm.grade} onChange={(e) => setGoalForm({ ...goalForm, grade: e.target.value })}>
                {(goalForm.type === 'boulder' ? boulderGrades : frenchGrades).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cg-target">Target</Label>
              <Input id="cg-target" type="number" min={1} inputMode="numeric" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: parseInt(e.target.value || '1', 10) || 1 })} />
            </div>
          </div>
          <Button type="submit" className="w-full sm:w-auto">Save goal</Button>
        </form>

        {goals.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>Active goals</div>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <Chip key={g.id}>{g.year} · {g.grade.toUpperCase()} × {g.target}</Chip>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Instagram story: goal + that day's session + charts. The sheet remounts per open so it starts fresh. */}
      <ShareStorySheet
        key={storyKey}
        open={storyDate !== null}
        onClose={() => setStoryDate(null)}
        goals={goals}
        initialDate={storyDate ?? date}
        initialStyle={storyClimb ? 'overlay' : undefined}
        initialClimbId={storyClimb ?? undefined}
      />

      {/* Share image style picker (story + 3 older styles) */}
      {overlayMenu && (
        <div
          ref={overlayMenuRef}
          role="menu"
          aria-label="Download share image"
          className="fixed z-50 rounded-[10px] border p-1"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--shadow-pop)',
            left: Math.max(8, Math.min(overlayMenu.x, window.innerWidth - 232)),
            top: Math.max(8, Math.min(overlayMenu.y, window.innerHeight - 320)),
            width: 224,
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="block min-h-11 w-full rounded-[8px] px-3 py-1.5 text-left hover:bg-[var(--surface-3)]"
            onClick={() => { openStory(String(overlayMenu.log.date).slice(0, 10)); setOverlayMenu(null); }}
          >
            <div className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>Share story</div>
            <div className="text-[12px]" style={{ color: 'var(--text-2)' }}>Goal, session and charts</div>
          </button>
          <button
            type="button"
            role="menuitem"
            className="block min-h-11 w-full rounded-[8px] px-3 py-1.5 text-left hover:bg-[var(--surface-3)]"
            onClick={() => { openStory(String(overlayMenu.log.date).slice(0, 10), overlayMenu.log.id); setOverlayMenu(null); }}
          >
            <div className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>Share this climb</div>
            <div className="text-[12px]" style={{ color: 'var(--text-2)' }}>Card for on top of your video</div>
          </button>
          <div className="mt-1 border-t px-3 pb-1 pt-2.5 text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)', borderColor: 'var(--border)' }}>More styles</div>
          {[
            { label: 'Centered', desc: 'Badge + meter + stats', fn: createOverlayV1 },
            { label: 'Compact', desc: 'Bottom-anchored minimal', fn: createOverlayV2 },
            { label: 'Bold', desc: 'Large left-aligned grade', fn: createOverlayV3 },
          ].map((v) => (
            <button
              key={v.label}
              type="button"
              role="menuitem"
              className="block min-h-11 w-full rounded-[8px] px-3 py-1.5 text-left hover:bg-[var(--surface-3)]"
              onClick={() => { v.fn(overlayMenu.log); setOverlayMenu(null); }}
            >
              <div className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>{v.label}</div>
              <div className="text-[12px]" style={{ color: 'var(--text-2)' }}>{v.desc}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className="num shrink-0 rounded-[8px] px-3 py-1.5 text-[14px] font-semibold" style={{ background: 'var(--accent-fill)', color: 'var(--on-accent-fill)' }}>
      {grade}
    </span>
  );
}

function RowActions({ onOverlay, onDelete }: { onOverlay: (e: React.MouseEvent) => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button small variant="outline" aria-haspopup="menu" onClick={onOverlay}>Share</Button>
      <Button small variant="ghost" aria-label="Delete send" onClick={onDelete}><X size={18} aria-hidden="true" /></Button>
    </div>
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
  const empty = <p className="py-6 text-center text-[14px]" style={{ color: 'var(--text-2)' }}>{loading ? 'Loading…' : 'No logs found'}</p>;
  return (
    <Card>
      <CardHeader title="All logs" meta={<span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{total} total · page {page}/{maxPage}</span>} />

      {/* Tablet and up: table */}
      <div className="hidden w-full overflow-x-auto sm:block">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Grade</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">S#</th>
              <th className="pb-2 pr-3 font-medium">Att.</th>
              <th className="pb-2 pr-3 font-medium">Location</th>
              <th className="pb-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 === 1 ? 'var(--surface-2)' : undefined }}>
                <td className="num whitespace-nowrap py-1 pl-1 pr-3">{l.date.slice(0, 10)}</td>
                <td className="num py-1 pr-3 font-semibold" style={{ color: 'var(--accent)' }}>{l.grade}</td>
                <td className="py-1 pr-3 capitalize">{l.type}</td>
                <td className="num py-1 pr-3">{l.session}</td>
                <td className="num py-1 pr-3">{l.attempts === 0 ? 'Flash' : l.attempts}</td>
                <td className="max-w-[12rem] truncate py-1 pr-3" style={{ color: 'var(--text-2)' }}>{l.location || '–'}</td>
                <td className="py-1 pr-1 text-right">
                  <div className="flex justify-end">
                    <RowActions onOverlay={(e) => onOverlay(l, e)} onDelete={() => onDelete(l.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Phone: cards */}
      <div className="space-y-2 sm:hidden">
        {items.length === 0 && empty}
        {items.map((l) => (
          <div key={l.id} className="rounded-[10px] px-3 py-2" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <GradeBadge grade={l.grade} />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>
                    {l.type === 'boulder' ? 'Boulder' : 'Rope'} · S{l.session} · {l.attempts === 0 ? 'Flash' : `${l.attempts} att`}
                  </div>
                  <div className="num truncate text-[13px]" style={{ color: 'var(--text-2)' }}>
                    {l.date.slice(0, 10)}{l.location ? ` · ${l.location}` : ''}
                  </div>
                </div>
              </div>
              <RowActions onOverlay={(e) => onOverlay(l, e)} onDelete={() => onDelete(l.id)} />
            </div>
            {l.notes && <div className="mt-1 truncate text-[13px]" style={{ color: 'var(--text-2)' }}>{l.notes}</div>}
          </div>
        ))}
      </div>

      {total > limit && (
        <div className="mt-3 flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={onPrev}>Prev</Button>
          <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{page} / {maxPage}</span>
          <Button variant="outline" disabled={page >= maxPage} onClick={onNext}>Next</Button>
        </div>
      )}
    </Card>
  );
}
