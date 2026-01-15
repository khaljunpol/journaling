"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const categories = [
  'sleep',
  'work',
  'hobbies / projects',
  'freelance',
  'exercise',
  'friends',
  'relaxation and leisure',
  'partner',
  'family',
  'productive / chores',
  'travel',
  'misc',
] as const;

const colors = ['#0ea5e9','#f59e0b','#22c55e','#a855f7','#ef4444','#eab308','#14b8a6','#fb7185','#8b5cf6','#06b6d4','#f97316','#64748b'];

function pad(n: number) { return String(n).padStart(2,'0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) { const [y,m,d] = s.split('-').map((x)=>parseInt(x,10)); return new Date(y,(m||1)-1,d||1); }

export default function TimeTrackerView() {
  const [account, setAccount] = useState<string>('Alex');
  const [date] = useState<string>(localTodayISO());
  const [hours, setHours] = useState<Array<number | null>>(Array.from({ length: 24 }, ()=>null));
  const [yearLogs, setYearLogs] = useState<Array<{ date: string; hour: number; category: number }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(1); // default to 'work'
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'month'|'year'>('month');
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [legendOpen, setLegendOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<Record<string, Record<number, number>>>({});
  const [lastPaintAt, setLastPaintAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const ctrlRef = useRef<AbortController|null>(null);

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
      const res = await fetch(`/api/time?date=${date}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal });
      const items: Array<{ date: string; hour: number; category: number }> = (res.ok ? await res.json() : []) || [];
      const arr = Array.from({ length: 24 }, ()=>null) as Array<number|null>;
      for (const it of items) { if (it && typeof it.hour === 'number') arr[it.hour] = it.category ?? null; }
      setHours(arr);
      // Year range based on selected viewYear
      const yFrom = `${viewYear}-01-01`;
      const yTo = `${viewYear}-12-31`;
      const yRes = await fetch(`/api/time?from=${yFrom}&to=${yTo}&account=${encodeURIComponent(account)}`);
      setYearLogs(yRes.ok ? await yRes.json() : []);
    } catch {
      setHours(Array.from({ length: 24 }, ()=>null));
    }
  }

  useEffect(() => { refresh(); }, [account, viewYear]);

  async function setHourAt(iso: string, h: number, category: number) {
    const body = { date: iso, hour: h, category };
    const res = await fetch(`/api/time?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      // If painting today, optimistically update local row; always refresh ranges
      if (iso === localTodayISO()) {
        const next = hours.slice(); next[h] = category; setHours(next);
      }
      refresh();
    }
  }

  async function flushDraft() {
    const entries: Array<{ iso: string; h: number; category: number }> = [];
    for (const iso of Object.keys(draft)) {
      const hoursMap = draft[iso] || {};
      for (const k of Object.keys(hoursMap)) {
        const h = parseInt(k, 10);
        const category = hoursMap[h];
        if (Number.isFinite(h) && Number.isFinite(category)) entries.push({ iso, h, category });
      }
    }
    if (entries.length === 0) return;
    setIsSaving(true);
    try {
      // Save sequentially to avoid API rate limits
      for (const e of entries) {
        // eslint-disable-next-line no-await-in-loop
        await setHourAt(e.iso, e.h, e.category);
      }
      setDraft({});
      setLastPaintAt(null);
    } finally {
      setIsSaving(false);
    }
  }

  function onPointerUp() { setIsPainting(false); }
  useEffect(() => {
    window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointerup', onPointerUp); };
  }, []);

  // Auto-save 5 seconds after last paint interaction
  useEffect(() => {
    if (!lastPaintAt || Object.keys(draft).length === 0) return;
    const now = Date.now();
    const remaining = Math.max(0, 5000 - (now - lastPaintAt));
    const t = setTimeout(() => { flushDraft(); }, remaining);
    return () => clearTimeout(t);
  }, [lastPaintAt, draft]);

  function buildDist(items: Array<{ date: string; hour: number; category: number }>) {
    const counts = new Array(categories.length).fill(0);
    for (const it of items) { if (typeof it.category === 'number') counts[it.category] += 1; }
    return counts.map((v, i) => ({ name: `${i} ${categories[i]}`, value: v, index: i }));
  }
  const yearDist = useMemo(() => buildDist(yearLogs), [yearLogs]);
  const monthDist = useMemo(() => {
    return buildDist(yearLogs.filter((it) => {
      const d = parseLocalDate(it.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }));
  }, [yearLogs, viewYear, viewMonth]);

  return (
    <section className="space-y-6">
      {/* Distribution summary for current view placed above tracker */}
      <div className="card p-4">
        <div className="card-title">Distribution ({viewMode==='month' ? 'Month' : 'Year'})</div>
        <div className="mt-2 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={(viewMode==='month' ? monthDist : yearDist).filter((d)=>d.value>0)}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label={(props: any) => {
                  const color = colors[(props && typeof props.index === 'number' ? props.index : 0) % colors.length];
                  const x = props?.x ?? 0;
                  const y = props?.y ?? 0;
                  const value = props?.value ?? '';
                  return (
                    <text x={x} y={y} dy={8} textAnchor="middle" fill={color} fontSize={12}>{value}</text>
                  );
                }}
              >
                {(viewMode==='month' ? monthDist : yearDist).filter((d)=>d.value>0).map((entry, index) => (
                  <Cell key={`cell-dist-top-${index}`} fill={colors[entry.index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 text-sm space-y-1">
          {(viewMode==='month' ? monthDist : yearDist).map((d) => (
            <li key={d.index} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: colors[d.index % colors.length] }} />
                {d.name}
              </span>
              <span style={{ color: colors[d.index % colors.length] }}>{d.value}h</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-medium">Time Tracker</div>
            <div className="flex rounded border overflow-hidden shrink-0">
              <button className={`px-2 py-1 text-xs ${viewMode==='month'?'text-(--accent) border-(--accent) font-medium':''}`} onClick={()=>setViewMode('month')}>Month</button>
              <button className={`px-2 py-1 text-xs ${viewMode==='year'?'text-(--accent) border-(--accent) font-medium':''}`} onClick={()=>setViewMode('year')}>Year</button>
            </div>
            <button className="px-2 py-1 text-xs border rounded" onClick={()=>setLegendOpen((v)=>!v)} title="Toggle legend">Legend</button>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <button className="px-2 py-1 text-xs border rounded" onClick={()=>setViewYear(viewYear-1)} title="Previous year">Prev</button>
            <div className="text-sm subtle" title="Viewing year">{viewYear}</div>
            <button className="px-2 py-1 text-xs border rounded" onClick={()=>setViewYear(viewYear+1)} title="Next year">Next</button>
          </div>
        </div>
        <div className="mt-3">
          {legendOpen && (
            <div className="mb-3">
              <div className="card-title">Legend</div>
              <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                {categories.map((label, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded" style={{ background: colors[i % colors.length] }} /> <span className="subtle">{i}</span> {label}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="subtle text-sm">Category:</span>
            {categories.map((label, i) => (
              <button key={i}
                className={`px-2 py-1 rounded text-xs border ${selectedCategory===i? 'ring-2 ring-(--accent)':''}`}
                style={{ background: colors[i % colors.length] }}
                onClick={()=>setSelectedCategory(i)}
                title={`${i} ${label}`}
              >{i}</button>
            ))}
          </div>
          <div className="mt-2">
            <button className="px-2 py-1 text-xs border rounded" onClick={flushDraft} disabled={isSaving || Object.keys(draft).length===0} title="Save changes">{isSaving ? 'Saving…' : 'Save'}</button>
          </div>
          <div className="mt-4">
            <div className="card-title">{viewMode==='month' ? 'This Month' : 'This Year'}</div>
            <div className="mt-2 -mx-2 px-2">
              <DaysRows
                viewYear={viewYear}
                viewMode={viewMode}
                viewMonth={viewMonth}
                yearLogs={yearLogs}
                draft={draft}
                paint={{
                  isPainting,
                  start: ()=> setIsPainting(true),
                  paint: (iso: string, h: number)=> {
                    setDraft((prev) => {
                      const next = { ...prev };
                      const hm = { ...(next[iso] || {}) };
                      hm[h] = selectedCategory;
                      next[iso] = hm;
                      return next;
                    });
                    setLastPaintAt(Date.now());
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DaysRows({ viewYear, viewMode, viewMonth, yearLogs, draft, paint }:{ viewYear: number; viewMode: 'month'|'year'; viewMonth: number; yearLogs: Array<{ date: string; hour: number; category: number }>; draft: Record<string, Record<number, number>>; paint: { isPainting: boolean; start: ()=>void; paint: (iso: string, h: number)=>void } }) {
  const year = viewYear;
  const byDate = new Map<string, Array<{ hour: number; category: number }>>();
  for (const it of yearLogs) {
    const arr = byDate.get(it.date) || [];
    arr.push({ hour: it.hour, category: it.category });
    byDate.set(it.date, arr);
  }
  const rows: Array<ReactNode> = [];
  const months = viewMode === 'year' ? Array.from({ length: 12 }, (_, i) => i) : [viewMonth];
  const todayISO = localTodayISO();
  const currentYear = new Date().getFullYear();
  for (const m of months) {
    // Month divider line with label only when showing the whole year
    if (viewMode === 'year') {
      rows.push(
        <div key={`month-divider-${year}-${m}`} className="flex items-center gap-2 mt-3">
          <div className="w-20 text-xs subtle">{new Date(year, m, 1).toLocaleString(undefined, { month: 'short' })}</div>
          <div className="flex-1 border-t" />
        </div>
      );
    }
    const days = new Date(year, m + 1, 0).getDate();
    for (let di = 1; di <= days; di++) {
      const iso = `${year}-${pad(m+1)}-${pad(di)}`;
      const label = `${pad(m+1)}-${pad(di)}`; // month-day only
      const isToday = (year === currentYear) && (iso === todayISO);
      rows.push(
        <div key={iso} className={`flex items-center gap-2 relative ${isToday ? 'ring-2 ring-(--accent) rounded' : ''}`}>
          <div className={`w-16 md:w-20 text-xs subtle sticky left-0 z-10 pr-2 bg-(--card) ${isToday ? 'text-(--accent) font-medium' : ''}`}>{label}</div>
          <div className="flex-1">
            <div className="grid grid-cols-24 gap-px">
              {Array.from({ length: 24 }, (_, h) => {
                const logs = byDate.get(iso) || [];
                const hit = logs.find((x)=>x.hour===h);
                const draftCategory = (draft && draft[iso] && typeof draft[iso][h] === 'number') ? draft[iso][h] : null;
                const bgCategory = draftCategory !== null ? draftCategory : (hit ? hit.category : null);
                const bg = (bgCategory !== null && bgCategory !== undefined) ? colors[bgCategory % colors.length] : 'transparent';
                return (
                  <div
                    key={h}
                    className="h-5 sm:h-6 md:h-7 rounded border flex items-center justify-center select-none text-[6px] sm:text-[7px] md:text-[10px] leading-none whitespace-nowrap overflow-hidden"
                    style={{ background: bg }}
                    onPointerDown={(e)=>{ e.preventDefault(); paint.start(); paint.paint(iso, h); }}
                    onPointerEnter={()=>{ if (paint.isPainting) paint.paint(iso, h); }}
                    title={`${iso} ${String(h).padStart(2,'0')}:00`}
                  >{String(h).padStart(2,'0')}</div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
  }
  return <div className="mt-2 space-y-1">{rows}</div>;
}
