"use client";

import { getCache, setCache } from '@/lib/cache';
import type { TimeCategory, TimeEntry } from '@/lib/types';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

type CatItem = TimeCategory;

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) { const [y, m, d] = s.split('-').map((x) => parseInt(x, 10)); return new Date(y, (m || 1) - 1, d || 1); }

export default function TimeTrackerView() {
  const [account, setAccount] = useState<string>('Alex');
  const [date] = useState<string>(localTodayISO());
  const [hours, setHours] = useState<Array<number | null>>(Array.from({ length: 24 }, () => null));
  const [yearLogs, setYearLogs] = useState<Array<TimeEntry>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(1); // default to 'work'
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth()); // 0-11
  // Legend always open; no toggle state
  const [draft, setDraft] = useState<Record<string, Record<number, number>>>({});
  const [lastPaintAt, setLastPaintAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [cats, setCats] = useState<CatItem[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dayUpdatedMs, setDayUpdatedMs] = useState<number | null>(null);
  const [yearUpdatedMs, setYearUpdatedMs] = useState<number | null>(null);
  const [catsUpdatedMs, setCatsUpdatedMs] = useState<number | null>(null);

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
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('storage', onStorage);
    window.addEventListener('account-change', onAccountChange as EventListener);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('account-change', onAccountChange as EventListener); window.removeEventListener('resize', onResize); };
  }, []);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();
      // Apply cached immediately
      const dayKey = `time:day:${account}:${date}`;
      const cachedDay = getCache<Array<TimeEntry>>(dayKey);
      if (cachedDay) {
        const items = Array.isArray(cachedDay.data) ? cachedDay.data : [];
        const arr = Array.from({ length: 24 }, () => null) as Array<number | null>;
        for (const it of items) { if (it && typeof it.hour === 'number') arr[it.hour] = it.category ?? null; }
        setHours(arr);
        try { setDayUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cachedDay.cachedAt))); } catch { }
      }
      const res = await fetch(`/api/time?date=${date}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal });
      const items: Array<TimeEntry> = (res.ok ? await res.json() : []) || [];
      const arr = Array.from({ length: 24 }, () => null) as Array<number | null>;
      for (const it of items) { if (it && typeof it.hour === 'number') arr[it.hour] = it.category ?? null; }
      setHours(arr);
      try { setCache(dayKey, items); } catch { }
      setDayUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
      // Year range based on selected viewYear
      const yFrom = `${viewYear}-01-01`;
      const yTo = `${viewYear}-12-31`;
      const yearKey = `time:year:${account}:${viewYear}`;
      const cachedYear = getCache<Array<TimeEntry>>(yearKey);
      if (cachedYear) { setYearLogs(Array.isArray(cachedYear.data) ? cachedYear.data : []); try { setYearUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cachedYear.cachedAt))); } catch { } }
      const yRes = await fetch(`/api/time?from=${yFrom}&to=${yTo}&account=${encodeURIComponent(account)}`);
      const yItems: Array<TimeEntry> = yRes.ok ? await yRes.json() : [];
      setYearLogs(Array.isArray(yItems) ? yItems : []);
      try { setCache(yearKey, Array.isArray(yItems) ? yItems : []); } catch { }
      setYearUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
      // Categories for legend and colors
      const catsKey = `time:cats:${account}`;
      const cachedCats = getCache<CatItem[]>(catsKey);
      if (cachedCats) { setCats(Array.isArray(cachedCats.data) ? cachedCats.data : []); try { setCatsUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cachedCats.cachedAt))); } catch { } }
      const cRes = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`);
      const list: CatItem[] = cRes.ok ? await cRes.json() : [];
      setCats(Array.isArray(list) ? list : []);
      try { setCache(catsKey, Array.isArray(list) ? list : []); } catch { }
      setCatsUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
    } catch {
      setHours(Array.from({ length: 24 }, () => null));
    }
  }

  useEffect(() => { refresh(); }, [account, viewYear]);

  async function saveBatchForDate(iso: string, items: Array<{ h: number; category: number }>) {
    if (!items.length) return;
    const body = { date: iso, entries: items.map((it) => ({ hour: it.h, category: it.category })) };
    const res = await fetch(`/api/time?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      if (iso === localTodayISO()) {
        const next = hours.slice();
        for (const it of items) { next[it.h] = it.category; }
        setHours(next);
      }
      return true;
    }
    return false;
  }

  async function flushDraft() {
    const byIso: Record<string, Array<{ h: number; category: number }>> = {};
    for (const iso of Object.keys(draft)) {
      const hoursMap = draft[iso] || {};
      const arr: Array<{ h: number; category: number }> = [];
      for (const k of Object.keys(hoursMap)) {
        const h = parseInt(k, 10);
        const category = hoursMap[h];
        if (Number.isFinite(h) && Number.isFinite(category)) arr.push({ h, category });
      }
      if (arr.length) byIso[iso] = arr.sort((a, b) => a.h - b.h);
    }
    const isoKeys = Object.keys(byIso);
    if (isoKeys.length === 0) return;
    setIsSaving(true);
    try {
      for (const iso of isoKeys) {
        // eslint-disable-next-line no-await-in-loop
        await saveBatchForDate(iso, byIso[iso]);
      }
      setDraft({});
      setLastPaintAt(null);
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function onPointerUp() { setIsPainting(false); }
  useEffect(() => {
    window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointerup', onPointerUp); };
  }, []);

  // Auto-save removed: only explicit Save triggers persist changes

  const catsSorted = useMemo(() => [...cats].sort((a, b) => a.order - b.order), [cats]);
  function getColor(idNum: number) {
    const it = cats.find((c) => parseInt(c.id, 10) === idNum);
    return it?.color || 'transparent';
  }
  function getName(idNum: number) {
    const it = cats.find((c) => parseInt(c.id, 10) === idNum);
    return it?.name || String(idNum);
  }
  function buildDist(items: Array<{ date: string; hour: number; category: number }>) {
    const counts: Record<number, number> = {};
    for (const it of items) { if (typeof it.category === 'number') counts[it.category] = (counts[it.category] || 0) + 1; }
    return catsSorted.map((c) => {
      const idNum = parseInt(c.id, 10);
      return { name: c.name, value: counts[idNum] || 0, index: idNum };
    });
  }
  const yearDist = useMemo(() => buildDist(yearLogs), [yearLogs, catsSorted]);
  const monthDist = useMemo(() => {
    return buildDist(yearLogs.filter((it) => {
      const d = parseLocalDate(it.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }));
  }, [yearLogs, viewYear, viewMonth, catsSorted]);

  const weeklyHours = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const count = yearLogs.filter(l => l.date === iso).length;
      return { iso, label: d.toLocaleDateString(undefined, { weekday: 'short' }), hours: count };
    });
  }, [yearLogs]);

  return (
    <section className="space-y-6">
      {/* ── LAST 7 DAYS ────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Last 7 Days</div>
          <div className="subtle text-xs">{weeklyHours.reduce((a, d) => a + d.hours, 0)}h total</div>
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyHours} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'var(--surface-alt)' }}
                content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="card rounded-lg px-2 py-1 text-xs shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-medium">{label}</span> · {payload[0]?.value}h
                    </div>
                  );
                }}
              />
              <Bar dataKey="hours" fill="var(--accent)" opacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution summary for current view placed above tracker */}
      <div className="card p-4">
        <div className="card-title">Distribution ({viewMode === 'month' ? 'Month' : 'Year'})</div>
        {(() => { const t = Math.max(dayUpdatedMs ?? 0, yearUpdatedMs ?? 0, catsUpdatedMs ?? 0); return t ? (<div className="subtle text-xs">Updated at {new Date(t).toLocaleTimeString()}</div>) : null; })()}
        <div className="mt-2 h-56 md:h-64 w-full relative z-10 overflow-visible">
          {cats.length > 0 ? (
            (() => {
              const currentData = (viewMode === 'month' ? monthDist : yearDist).filter((d) => d.value > 0);
              if (currentData.length === 0) {
                return <div className="h-full w-full flex items-center justify-center subtle text-sm">No data for this {viewMode}.</div>;
              }
              return isMobile ? (
                <PieChart width={320} height={208}>
                  <Pie
                    data={currentData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label={(props: any) => {
                      const color = getColor((props && typeof props.index === 'number' ? props.index : 0));
                      const x = props?.x ?? 0;
                      const y = props?.y ?? 0;
                      const pct = typeof props?.percent === 'number' ? Math.round(props.percent * 100) : '';
                      return (
                        <text x={x} y={y} dy={8} textAnchor="middle" fill={color} fontSize={12}>{pct !== '' ? `${pct}%` : ''}</text>
                      );
                    }}
                  >
                    {currentData.map((entry, index) => (
                      <Cell key={`cell-dist-top-${index}`} fill={getColor(entry.index)} />
                    ))}
                  </Pie>
                  <Tooltip wrapperStyle={{ zIndex: 50 }} />
                </PieChart>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label={(props: any) => {
                        const color = getColor((props && typeof props.index === 'number' ? props.index : 0));
                        const x = props?.x ?? 0;
                        const y = props?.y ?? 0;
                        const pct = typeof props?.percent === 'number' ? Math.round(props.percent * 100) : '';
                        return (
                          <text x={x} y={y} dy={8} textAnchor="middle" fill={color} fontSize={12}>{pct !== '' ? `${pct}%` : ''}</text>
                        );
                      }}
                    >
                      {currentData.map((entry, index) => (
                        <Cell key={`cell-dist-top-${index}`} fill={getColor(entry.index)} />
                      ))}
                    </Pie>
                    <Tooltip wrapperStyle={{ zIndex: 50 }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()
          ) : (
            <div className="h-full w-full flex items-center justify-center subtle text-sm">Loading categories…</div>
          )}
        </div>
        <ul className="mt-4 text-sm space-y-1 relative z-0">
          {[...(viewMode === 'month' ? monthDist : yearDist)].sort((a, b) => (b.value - a.value)).map((d) => (
            <li key={d.index} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: getColor(d.index) }} />
                {d.name}
              </span>
              <span style={{ color: getColor(d.index) }}>{d.value}h</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-medium">Time Tracker</div>
            <div className="flex rounded border overflow-hidden shrink-0">
              <button className={`px-2 py-1 text-xs ${viewMode === 'month' ? 'text-(--accent) border-(--accent) font-medium' : ''}`} onClick={() => setViewMode('month')}>Month</button>
              <button className={`px-2 py-1 text-xs ${viewMode === 'year' ? 'text-(--accent) border-(--accent) font-medium' : ''}`} onClick={() => setViewMode('year')}>Year</button>
            </div>
            {/* Legend toggle removed; legend acts as picker and is always visible */}
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <button
              className="px-2 py-1 text-xs border rounded"
              onClick={() => {
                if (viewMode === 'month') {
                  const prevMonth = viewMonth - 1;
                  if (prevMonth < 0) { setViewYear(viewYear - 1); setViewMonth(11); }
                  else { setViewMonth(prevMonth); }
                } else {
                  setViewYear(viewYear - 1);
                }
              }}
              title={viewMode === 'month' ? 'Previous month' : 'Previous year'}
            >Prev</button>
            <div className="text-sm subtle" title={viewMode === 'month' ? 'Viewing month' : 'Viewing year'}>
              {viewMode === 'month' ? new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' }) : viewYear}
            </div>
            <button
              className="px-2 py-1 text-xs border rounded"
              onClick={() => {
                if (viewMode === 'month') {
                  const nextMonth = viewMonth + 1;
                  if (nextMonth > 11) { setViewYear(viewYear + 1); setViewMonth(0); }
                  else { setViewMonth(nextMonth); }
                } else {
                  setViewYear(viewYear + 1);
                }
              }}
              title={viewMode === 'month' ? 'Next month' : 'Next year'}
            >Next</button>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-3">
            <div className="card-title">Legend</div>
            <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
              {catsSorted.map((c) => {
                const i = parseInt(c.id, 10);
                const selected = selectedCategory === i;
                return (
                  <li
                    key={c.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded border cursor-pointer ${selected ? 'ring-2 ring-(--accent) font-medium' : ''}`}
                    onClick={() => setSelectedCategory(i)}
                    title={`Select ${c.name}`}
                  >
                    <span className="inline-block h-3 w-3 rounded" style={{ background: c.color }} />
                    {c.name}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-2">
            <button className="px-2 py-1 text-xs border rounded" onClick={flushDraft} disabled={isSaving || Object.keys(draft).length === 0} title="Save changes">{isSaving ? 'Saving…' : 'Save'}</button>
          </div>
          <div className="mt-4">
            <div className="card-title">{viewMode === 'month' ? 'This Month' : 'This Year'}</div>
            <div className="mt-2 -mx-2 px-2">
              <DaysRows
                viewYear={viewYear}
                viewMode={viewMode}
                viewMonth={viewMonth}
                yearLogs={yearLogs}
                draft={draft}
                getColor={getColor}
                paint={{
                  isPainting,
                  start: () => setIsPainting(true),
                  paint: (iso: string, h: number) => {
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

function DaysRows({ viewYear, viewMode, viewMonth, yearLogs, draft, getColor, paint }: { viewYear: number; viewMode: 'month' | 'year'; viewMonth: number; yearLogs: Array<{ date: string; hour: number; category: number }>; draft: Record<string, Record<number, number>>; getColor: (id: number) => string; paint: { isPainting: boolean; start: () => void; paint: (iso: string, h: number) => void } }) {
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
      const iso = `${year}-${pad(m + 1)}-${pad(di)}`;
      const label = `${pad(m + 1)}-${pad(di)}`; // month-day only
      const isToday = (year === currentYear) && (iso === todayISO);
      rows.push(
        <div key={iso} className={`flex items-center gap-0 relative ${isToday ? 'ring-2 ring-(--accent) rounded' : ''}`}>
          <div className={`w-12 md:w-16 text-xs subtle sticky left-0 z-10 bg-(--card) ${isToday ? 'text-(--accent) font-medium' : ''}`}>{label}</div>
          <div className="flex-1">
            <div className="grid grid-cols-24 gap-px">
              {Array.from({ length: 24 }, (_, h) => {
                const logs = byDate.get(iso) || [];
                const hit = logs.find((x) => x.hour === h);
                const draftCategory = (draft && draft[iso] && typeof draft[iso][h] === 'number') ? draft[iso][h] : null;
                const bgCategory = draftCategory !== null ? draftCategory : (hit ? hit.category : null);
                const cellBg = (bgCategory !== null && bgCategory !== undefined) ? getColor(bgCategory as number) : 'transparent';
                return (
                  <div
                    key={h}
                    className="h-5 sm:h-6 md:h-7 rounded border flex items-center justify-center select-none text-[6px] sm:text-[7px] md:text-[10px] leading-none whitespace-nowrap overflow-hidden"
                    style={{ background: cellBg }}
                    onPointerDown={(e) => { e.preventDefault(); paint.start(); paint.paint(iso, h); }}
                    onPointerEnter={() => { if (paint.isPainting) paint.paint(iso, h); }}
                    title={`${iso} ${String(h + 1).padStart(2, '0')}:00`}
                  >{String(h + 1).padStart(2, '0')}</div>
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
