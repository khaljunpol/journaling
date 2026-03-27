"use client";

import { getCache, setCache } from '@/lib/cache';
import { parseCookies } from '@/lib/apiHelpers';
import type { TimeCategory, TimeEntry } from '@/lib/types';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

type CatItem = TimeCategory;

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) { const [y, m, d] = s.split('-').map((x) => parseInt(x, 10)); return new Date(y, (m || 1) - 1, d || 1); }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TimeTrackerView() {
  const [account, setAccount] = useState<string>('Alex');
  const [date] = useState<string>(localTodayISO());
  const [hours, setHours] = useState<Array<number | null>>(Array.from({ length: 24 }, () => null));
  const [yearLogs, setYearLogs] = useState<Array<TimeEntry>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(1);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth());
  const [draft, setDraft] = useState<Record<string, Record<number, number>>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [cats, setCats] = useState<CatItem[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);

  const unsavedCount = useMemo(
    () => Object.values(draft).reduce((sum, hm) => sum + Object.keys(hm).length, 0),
    [draft],
  );

  useEffect(() => {
    const cookieAccount = (() => {
      try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; }
    })();
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
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('account-change', onAccountChange as EventListener);
    };
  }, []);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();

      const dayKey = `time:day:${account}:${date}`;
      const cachedDay = getCache<Array<TimeEntry>>(dayKey);
      if (cachedDay) {
        const arr = Array.from({ length: 24 }, () => null) as Array<number | null>;
        for (const it of Array.isArray(cachedDay.data) ? cachedDay.data : []) {
          if (it && typeof it.hour === 'number') arr[it.hour] = it.category ?? null;
        }
        setHours(arr);
      }
      const res = await fetch(`/api/time?date=${date}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal });
      const items: Array<TimeEntry> = (res.ok ? await res.json() : []) || [];
      const arr = Array.from({ length: 24 }, () => null) as Array<number | null>;
      for (const it of items) { if (it && typeof it.hour === 'number') arr[it.hour] = it.category ?? null; }
      setHours(arr);
      try { setCache(dayKey, items); } catch {}

      const yFrom = `${viewYear}-01-01`;
      const yTo = `${viewYear}-12-31`;
      const yearKey = `time:year:${account}:${viewYear}`;
      const cachedYear = getCache<Array<TimeEntry>>(yearKey);
      if (cachedYear) setYearLogs(Array.isArray(cachedYear.data) ? cachedYear.data : []);
      const yRes = await fetch(`/api/time?from=${yFrom}&to=${yTo}&account=${encodeURIComponent(account)}`);
      const yItems: Array<TimeEntry> = yRes.ok ? await yRes.json() : [];
      setYearLogs(Array.isArray(yItems) ? yItems : []);
      try { setCache(yearKey, Array.isArray(yItems) ? yItems : []); } catch {}

      const catsKey = `time:cats:${account}`;
      const cachedCats = getCache<CatItem[]>(catsKey);
      if (cachedCats) setCats(Array.isArray(cachedCats.data) ? cachedCats.data : []);
      const cRes = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`);
      const list: CatItem[] = cRes.ok ? await cRes.json() : [];
      setCats(Array.isArray(list) ? list : []);
      try { setCache(catsKey, Array.isArray(list) ? list : []); } catch {}
    } catch {
      setHours(Array.from({ length: 24 }, () => null));
    }
  }

  useEffect(() => { refresh(); }, [account, viewYear]);

  async function saveBatchForDate(iso: string, items: Array<{ h: number; category: number }>) {
    if (!items.length) return false;
    const res = await fetch(`/api/time?account=${encodeURIComponent(account)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: iso, entries: items.map((it) => ({ hour: it.h, category: it.category })) }),
    });
    if (res.ok && iso === localTodayISO()) {
      const next = hours.slice();
      for (const it of items) next[it.h] = it.category;
      setHours(next);
    }
    return res.ok;
  }

  async function flushDraft() {
    const byIso: Record<string, Array<{ h: number; category: number }>> = {};
    for (const iso of Object.keys(draft)) {
      const arr: Array<{ h: number; category: number }> = [];
      for (const k of Object.keys(draft[iso] || {})) {
        const h = parseInt(k, 10);
        const category = draft[iso][h];
        if (Number.isFinite(h) && Number.isFinite(category)) arr.push({ h, category });
      }
      if (arr.length) byIso[iso] = arr.sort((a, b) => a.h - b.h);
    }
    if (!Object.keys(byIso).length) return;
    setIsSaving(true);
    try {
      for (const iso of Object.keys(byIso)) {
        // eslint-disable-next-line no-await-in-loop
        await saveBatchForDate(iso, byIso[iso]);
      }
      setDraft({});
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function onPointerUp() { setIsPainting(false); }
  useEffect(() => {
    window.addEventListener('pointerup', onPointerUp);
    return () => window.removeEventListener('pointerup', onPointerUp);
  }, []);

  const catsSorted = useMemo(() => [...cats].sort((a, b) => a.order - b.order), [cats]);

  function getColor(idNum: number) {
    return cats.find((c) => parseInt(c.id, 10) === idNum)?.color || 'transparent';
  }
  function getName(idNum: number) {
    return cats.find((c) => parseInt(c.id, 10) === idNum)?.name || String(idNum);
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
  const monthDist = useMemo(() => buildDist(
    yearLogs.filter((it) => {
      const d = parseLocalDate(it.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    })
  ), [yearLogs, viewYear, viewMonth, catsSorted]);

  const weeklyHours = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { iso, label: d.toLocaleDateString(undefined, { weekday: 'short' }), hours: yearLogs.filter(l => l.date === iso).length };
  }), [yearLogs]);

  const weeklyTotal = weeklyHours.reduce((a, d) => a + d.hours, 0);

  const currentDist = viewMode === 'month' ? monthDist : yearDist;
  const distTotal = currentDist.reduce((s, d) => s + d.value, 0);
  const distFiltered = [...currentDist].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  function prevPeriod() {
    if (viewMode === 'month') {
      if (viewMonth === 0) { setViewYear(v => v - 1); setViewMonth(11); }
      else setViewMonth(m => m - 1);
    } else {
      setViewYear(v => v - 1);
    }
  }
  function nextPeriod() {
    if (viewMode === 'month') {
      if (viewMonth === 11) { setViewYear(v => v + 1); setViewMonth(0); }
      else setViewMonth(m => m + 1);
    } else {
      setViewYear(v => v + 1);
    }
  }

  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
    : String(viewYear);

  return (
    <section className="space-y-6">

      {/* ── LAST 7 DAYS ──────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold">Last 7 days</h2>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
            {weeklyTotal}h
          </span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>logged</span>
        </div>
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyHours} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-alt)' }}
                content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  return (
                    <div
                      className="rounded-xl px-3 py-1.5 text-xs shadow-lg"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      <span className="font-medium">{label}</span> · {payload[0]?.value}h
                    </div>
                  );
                }}
              />
              <Bar dataKey="hours" fill="var(--accent)" opacity={0.85} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── DISTRIBUTION ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header + period nav */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Distribution</h2>
            {/* Month / Year pill toggle */}
            <div
              className="flex rounded-full p-0.5 text-xs"
              style={{ background: 'var(--surface-alt)' }}
            >
              {(['month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="rounded-full px-3 py-1.5 font-medium transition-all capitalize"
                  style={viewMode === mode
                    ? { background: 'var(--accent)', color: 'var(--accent-foreground)' }
                    : { color: 'var(--muted-foreground)' }
                  }
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              aria-label="Previous period"
              onClick={prevPeriod}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors active:scale-95"
              style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
            >←</button>
            <span className="text-sm min-w-[110px] text-center font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {periodLabel}
            </span>
            <button
              aria-label="Next period"
              onClick={nextPeriod}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors active:scale-95"
              style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
            >→</button>
          </div>
        </div>

        {cats.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Loading…
          </div>
        ) : distFiltered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No data logged for this {viewMode}.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Donut chart */}
            <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distFiltered}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    strokeWidth={0}
                    paddingAngle={2}
                  >
                    {distFiltered.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColor(entry.index)} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 50 }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div
                          className="rounded-xl px-3 py-1.5 text-xs shadow-lg"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        >
                          <span className="font-medium">{d.name}</span> · {d.value}h
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold">{distTotal}</span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>hours</span>
              </div>
            </div>

            {/* Distribution list with mini bars */}
            <ul className="flex-1 w-full space-y-2">
              {distFiltered.map((d) => {
                const pct = distTotal > 0 ? Math.round((d.value / distTotal) * 100) : 0;
                const color = getColor(d.index);
                return (
                  <li key={d.index}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        {d.name}
                      </span>
                      <span className="tabular-nums text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {d.value}h · {pct}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* ── TIME TRACKER GRID ────────────────────────────────── */}
      <div
        className="rounded-2xl p-3 sm:p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Time tracker</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {viewMode === 'month' ? periodLabel : `${periodLabel} · all months`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous period"
              onClick={prevPeriod}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors active:scale-95"
              style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
            >←</button>
            <button
              aria-label="Next period"
              onClick={nextPeriod}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors active:scale-95"
              style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
            >→</button>
          </div>
        </div>

        {/* Category picker */}
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>Painting with</p>
          <div className="flex flex-wrap gap-2">
            {catsSorted.map((c) => {
              const i = parseInt(c.id, 10);
              const isSelected = selectedCategory === i;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(i)}
                  title={c.name}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-all active:scale-95"
                  style={isSelected
                    ? { background: `${c.color}22`, color: c.color, boxShadow: `0 0 0 1.5px ${c.color}` }
                    : { background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }
                  }
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
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
            },
          }}
        />

        {/* Save */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {unsavedCount > 0 ? `${unsavedCount} unsaved cell${unsavedCount > 1 ? 's' : ''}` : ''}
          </span>
          <button
            className="rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
            onClick={flushDraft}
            disabled={isSaving || unsavedCount === 0}
          >
            {isSaving ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}

function HourHeader() {
  return (
    <div className="flex items-center gap-1 mb-1">
      <div className="w-7 shrink-0" />
      <div className="flex-1 grid grid-cols-24">
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="text-center select-none overflow-hidden"
            style={{ fontSize: 8, color: 'var(--muted-foreground)', lineHeight: 1 }}
          >
            {h % 6 === 0 ? h : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function DaysRows({
  viewYear, viewMode, viewMonth, yearLogs, draft, getColor, paint,
}: {
  viewYear: number;
  viewMode: 'month' | 'year';
  viewMonth: number;
  yearLogs: Array<{ date: string; hour: number; category: number }>;
  draft: Record<string, Record<number, number>>;
  getColor: (id: number) => string;
  paint: { isPainting: boolean; start: () => void; paint: (iso: string, h: number) => void };
}) {
  const byDate = new Map<string, Array<{ hour: number; category: number }>>();
  for (const it of yearLogs) {
    const arr = byDate.get(it.date) || [];
    arr.push({ hour: it.hour, category: it.category });
    byDate.set(it.date, arr);
  }

  const rows: Array<ReactNode> = [];
  const months = viewMode === 'year' ? Array.from({ length: 12 }, (_, i) => i) : [viewMonth];
  const todayISO = localTodayISO();

  for (const m of months) {
    if (viewMode === 'year') {
      rows.push(
        <div key={`divider-${viewYear}-${m}`} className="flex items-center gap-1 mt-4 mb-1">
          <span className="text-[10px] font-medium w-7 shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            {MONTH_SHORT[m]}
          </span>
          <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
        </div>
      );
    }

    const days = new Date(viewYear, m + 1, 0).getDate();
    for (let di = 1; di <= days; di++) {
      const iso = `${viewYear}-${pad(m + 1)}-${pad(di)}`;
      const isToday = iso === todayISO;

      rows.push(
        <div
          key={iso}
          className="flex items-center gap-1"
          style={isToday ? { borderRadius: 6, outline: `1.5px solid var(--accent)`, outlineOffset: 1 } : undefined}
        >
          {/* Date label — compact */}
          <div
            className="w-7 shrink-0 text-center"
            style={{ color: isToday ? 'var(--accent)' : 'var(--muted-foreground)' }}
          >
            <span className="text-[10px] font-medium leading-none">{di}</span>
          </div>

          {/* 24 hour cells with hour numbers */}
          <div className="flex-1 grid grid-cols-24">
            {Array.from({ length: 24 }, (_, h) => {
              const logs = byDate.get(iso) || [];
              const hit = logs.find((x) => x.hour === h);
              const draftCat = (draft[iso] && typeof draft[iso][h] === 'number') ? draft[iso][h] : null;
              const bgCategory = draftCat !== null ? draftCat : (hit ? hit.category : null);
              const filled = bgCategory !== null && bgCategory !== undefined;
              const cellBg = filled ? getColor(bgCategory as number) : undefined;

              return (
                <div
                  key={h}
                  className="h-6 sm:h-7 select-none cursor-crosshair flex items-center justify-center overflow-hidden"
                  style={{
                    background: filled ? cellBg : 'var(--border)',
                    fontSize: 7,
                    color: filled ? 'rgba(0,0,0,0.45)' : 'var(--muted-foreground)',
                    lineHeight: 1,
                    borderRight: h < 23 ? '0.5px solid var(--surface)' : undefined,
                  }}
                  onPointerDown={(e) => { e.preventDefault(); paint.start(); paint.paint(iso, h); }}
                  onPointerEnter={() => { if (paint.isPainting) paint.paint(iso, h); }}
                  title={`${iso} ${pad(h)}:00–${pad(h + 1)}:00`}
                >
                  {h}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="space-y-px">
      <HourHeader />
      {rows}
    </div>
  );
}
