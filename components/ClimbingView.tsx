"use client";

import { getCache, setCache } from '@/lib/cache';
import type { ClimbGoal, ClimbLog } from '@/lib/types';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}
function toLocalISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function vScaleToNumber(grade: string): number | null {
  const m = /^v\s*(\d+)$/i.exec(grade.trim());
  if (!m) return null; return parseInt(m[1], 10);
}

const boulderGrades = Array.from({ length: 13 }, (_, i) => `V${i}`); // V0..V12
const frenchGrades = [
  '5a', '5a+', '5b', '5b+', '5c', '5c+', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c'
];
function frenchToIndex(g: string): number | null {
  const idx = frenchGrades.findIndex((x) => x.toLowerCase() === g.trim().toLowerCase());
  return idx >= 0 ? idx : null;
}

function weekStartLocal(d: Date) {
  const day = d.getDay() || 7; // Sun=0, Mon=1..Sun=7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
  return start;
}

// Normalize grade strings to a canonical form for reliable matching
function normalizeGrade(type: 'boulder' | 'rope', grade: string): string {
  const g = grade.trim().toLowerCase();
  if (type === 'boulder') {
    const n = vScaleToNumber(g);
    // Canonical: 'v<number>' if parseable, else compact string without spaces
    return n != null ? `v${n}` : g.replace(/\s+/g, '');
  }
  // Rope: map to canonical French grade from list if possible
  const idx = frenchToIndex(g);
  return idx != null ? frenchGrades[idx] : g.replace(/\s+/g, '');
}

export default function ClimbingView() {
  const today = useMemo(() => localTodayISO(), []);
  const [account, setAccount] = useState<string>('Alex');
  const [date, setDate] = useState<string>(today);
  const [logs, setLogs] = useState<Array<ClimbLog>>([]);
  const [rangeLogs, setRangeLogs] = useState<Array<ClimbLog>>([]);
  const [goals, setGoals] = useState<Array<ClimbGoal>>([]);
  const [yearLogs, setYearLogs] = useState<Array<ClimbLog>>([]);
  const [yearLogsByYear, setYearLogsByYear] = useState<Record<number, Array<ClimbLog>>>({});
  const [selectedGoal, setSelectedGoal] = useState<{ id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const yearCacheRef = useRef<Map<string, Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>>>(new Map());
  const GoalOverlay = useMemo(() => dynamic(() => import('./GoalOverlay'), { ssr: false }), []);
  const YearSummaryChart = useMemo(() => dynamic(() => import('./YearSummaryChart'), { ssr: false }), []);
  const [isYearSwitchPending, startYearSwitchTransition] = useTransition();
  const [updatedMs, setUpdatedMs] = useState<number | null>(null);

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
      // Prepare date window once
      const end = parseLocalDate(date);
      const start = new Date(end);
      start.setDate(start.getDate() - 119);
      const fromISO = toLocalISO(start);
      const toISO = toLocalISO(end);
      // Apply cached immediately where available
      const dayKey = `climb:day:${account}:${date}`;
      const goalsKey = `climb:goals:${account}`;
      const rangeKey = `climb:range:${account}:${fromISO}|${toISO}`;
      const cachedDay = getCache<typeof logs>(dayKey);
      if (cachedDay) setLogs(Array.isArray(cachedDay.data) ? cachedDay.data : []);
      if (cachedDay) { try { setUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cachedDay.cachedAt))); } catch { } }
      const cachedGoals = getCache<typeof goals>(goalsKey);
      if (cachedGoals) setGoals(Array.isArray(cachedGoals.data) ? cachedGoals.data : []);
      if (cachedGoals) { try { setUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cachedGoals.cachedAt))); } catch { } }
      const cachedRange = getCache<typeof rangeLogs>(rangeKey);
      if (cachedRange) setRangeLogs(Array.isArray(cachedRange.data) ? cachedRange.data : []);
      if (cachedRange) { try { setUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cachedRange.cachedAt))); } catch { } }
      // Fetch logs, goals, and range logs in parallel
      const [dayResp, goalsResp, rangeResp] = await Promise.all([
        fetch(`/api/climbing/logs?date=${date}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal }),
        fetch(`/api/climbing/goals?account=${encodeURIComponent(account)}`),
        fetch(`/api/climbing/logs?from=${fromISO}&to=${toISO}&account=${encodeURIComponent(account)}`),
      ]);
      const dayItems: Array<ClimbLog> = dayResp.ok ? await dayResp.json() : [];
      const gs: Array<ClimbGoal> = goalsResp.ok ? await goalsResp.json() : [];
      const rangeItems: Array<ClimbLog> = rangeResp.ok ? await rangeResp.json() : [];
      setLogs(Array.isArray(dayItems) ? dayItems : []);
      setGoals(Array.isArray(gs) ? gs : []);
      setRangeLogs(Array.isArray(rangeItems) ? rangeItems : []);
      try { setCache(dayKey, Array.isArray(dayItems) ? dayItems : []); } catch { }
      try { setCache(goalsKey, Array.isArray(gs) ? gs : []); } catch { }
      try { setCache(rangeKey, Array.isArray(rangeItems) ? rangeItems : []); } catch { }
      setUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
      // Fetch logs per goal year for accurate progress (use simple client cache to avoid repeat calls)
      const gYears = Array.isArray(gs) ? Array.from(new Set(gs.map((g: any) => g.year))) : [];
      if (gYears.length) {
        const YEAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes freshness window
        const entries = await Promise.all(gYears.map(async (yr: number) => {
          const cacheKey = `${account}|${yr}`;
          // Prefer localStorage cache if fresh; otherwise fetch
          const lsKey = `climb:year:${account}:${yr}`;
          const cached = getCache<Array<ClimbLog>>(lsKey);
          const isFresh = cached && (() => { try { return (Date.now() - Date.parse(cached.cachedAt)) < YEAR_CACHE_TTL_MS; } catch { return false; } })();
          if (isFresh && cached) {
            const arr = Array.isArray(cached.data) ? cached.data : [];
            yearCacheRef.current.set(cacheKey, arr);
            return [yr, arr] as const;
          }
          const yrStart = `${yr}-01-01`;
          const yrEnd = `${yr}-12-31`;
          const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}&account=${encodeURIComponent(account)}`);
          const items: Array<ClimbLog> = resp.ok ? await resp.json() : [];
          const arr: Array<ClimbLog> = Array.isArray(items) ? items : [];
          yearCacheRef.current.set(cacheKey, arr);
          try { setCache(lsKey, arr); } catch { }
          return [yr, arr] as const;
        }));
        const map: Record<number, Array<ClimbLog>> = {};
        for (const [yr, arr] of entries) { map[yr] = arr; }
        setYearLogsByYear(map);
      } else {
        setYearLogsByYear({});
      }
    } catch { setLogs([]); }
  }

  useEffect(() => { refresh(); }, [date, account]);

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}&account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
  }

  const thisYear = new Date().getFullYear();
  const logs30 = useMemo(() => {
    const d = parseLocalDate(date);
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const from = new Date(to); from.setDate(from.getDate() - 29);
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
    const vNums = logs30.filter((l) => l.type === 'boulder').map((l) => vScaleToNumber(l.grade)).filter((n): n is number => n != null);
    const vTrend = vNums.length >= 2 ? (vNums[vNums.length - 1] - vNums[0]) : 0;
    const ropeNums = logs30.filter((l) => l.type === 'rope').map((l) => frenchToIndex(l.grade)).filter((n): n is number => n != null);
    const ropeTrend = ropeNums.length >= 2 ? (ropeNums[ropeNums.length - 1] - ropeNums[0]) : 0;
    const half = Math.floor(logs30.length / 2) || 1;
    const avgFirst = logs30.slice(0, half).reduce((a, l) => a + (l.attempts || 0), 0) / Math.max(1, logs30.slice(0, half).length);
    const avgSecond = logs30.slice(half).reduce((a, l) => a + (l.attempts || 0), 0) / Math.max(1, logs30.slice(half).length);
    const attemptsTrend = Math.round(((avgSecond - avgFirst)) * 10) / 10;
    return { total, flashes, flashRate: total ? Math.round((flashes / total) * 100) : 0, avgAttempts, vTrend, ropeTrend, attemptsTrend };
  }, [logs30]);

  const weekly = useMemo(() => {
    const end = parseLocalDate(date);
    const endStart = weekStartLocal(end);
    const buckets: Array<{ key: string; date: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(endStart);
      ws.setDate(ws.getDate() - i * 7);
      const key = toLocalISO(ws);
      buckets.push({ key, date: key, count: 0 });
    }
    const map = new Map(buckets.map(b => [b.key, b]));
    for (const l of rangeLogs) {
      const dt = parseLocalDate(l.date);
      const ws = weekStartLocal(dt);
      const key = toLocalISO(ws);
      const b = map.get(key);
      if (b) b.count += 1;
    }
    const arr = Array.from(map.values());
    const avg = arr.length ? Math.round((arr.reduce((a, b) => a + b.count, 0) / arr.length) * 10) / 10 : 0;
    const activeWeeks = arr.filter((w) => w.count > 0).length;
    return { series: arr, avg, activeWeeks };
  }, [rangeLogs, date]);

  const consistency = useMemo(() => {
    const end = new Date(date);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const set = new Set(rangeLogs
      .filter((l) => { const t = new Date(l.date).getTime(); return t >= start.getTime() && t <= end.getTime(); })
      .map((l) => l.date.slice(0, 10))
    );
    const days = set.size;
    const weeksActiveRate = weekly.series.length ? Math.round((weekly.activeWeeks / weekly.series.length) * 100) : 0;
    return { daysLast7: days, weeksActive: weekly.activeWeeks, weeksTotal: weekly.series.length, weeksActiveRate };
  }, [rangeLogs, date, weekly]);

  const byGrade30 = useMemo(() => {
    const map: Record<string, { count: number; flashes: number; attempts: number }> = {};
    for (const l of logs30) {
      const k = `${l.type}|${l.grade.toLowerCase()}`;
      const m = (map[k] ||= { count: 0, flashes: 0, attempts: 0 });
      m.count += 1; m.attempts += (l.attempts || 0); if (l.attempts === 0) m.flashes += 1;
    }
    const rows = Object.entries(map).map(([key, v]) => {
      const [type, grade] = key.split('|');
      const avgAtt = v.count ? Math.round((v.attempts / v.count) * 10) / 10 : 0;
      const flashRate = v.count ? Math.round((v.flashes / v.count) * 100) : 0;
      return { type, grade, count: v.count, flashRate, avgAttempts: avgAtt };
    }).sort((a, b) => b.count - a.count).slice(0, 8);
    return rows;
  }, [logs30]);



  const goalsProgress = useMemo(() => {
    return goals.map((g) => {
      const logsForYear = yearLogsByYear[g.year] || [];
      const done = logsForYear.reduce((acc, l) => {
        const lg = normalizeGrade(l.type, l.grade);
        const gg = normalizeGrade(g.type, g.grade);
        return acc + ((l.type === g.type && lg === gg) ? 1 : 0);
      }, 0);
      const pct = g.target ? Math.min(100, Math.round((done / g.target) * 100)) : 0;
      return { ...g, done, pct };
    });
  }, [goals, yearLogsByYear]);

  const [goalsYear, setGoalsYear] = useState<number>(thisYear);
  const goalsYears = useMemo(() => {
    const set = new Set(goalsProgress.map((g) => g.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [goalsProgress]);
  useEffect(() => {
    if (goalsYears.length === 0) return;
    if (goalsYears.includes(thisYear)) setGoalsYear(thisYear);
    else setGoalsYear(goalsYears[goalsYears.length - 1]);
  }, [goalsYears]);
  const goalsForSelectedYear = useMemo(() => {
    return goalsProgress
      .filter((g) => g.year === goalsYear)
      .slice()
      .sort((a, b) => b.pct - a.pct || (b.done - a.done));
  }, [goalsProgress, goalsYear]);

  const yearSummary = useMemo(() => {
    const ylogs = yearLogsByYear[goalsYear] || [];
    const total = ylogs.length;
    if (!total) {
      return { total: 0, flashes: 0, flashRate: 0, avgAttempts: 0, days: 0, weeks: 0, weeklyAvg: 0, bestWeek: 0, bestBoulder: null as null | string, bestRope: null as null | string, series: [] as Array<{ date: string; count: number }> };
    }
    const flashes = ylogs.filter((l) => l.attempts === 0).length;
    const flashRate = Math.round((flashes / total) * 100);
    const avgAttempts = Math.round((ylogs.reduce((a, l) => a + (l.attempts || 0), 0) / total) * 10) / 10;
    const daySet = new Set(ylogs.map((l) => l.date.slice(0, 10)));
    const days = daySet.size;
    const weekMap = new Map<string, number>();
    for (const l of ylogs) {
      const ws = weekStartLocal(parseLocalDate(l.date));
      const key = toLocalISO(ws);
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    }
    const weeks = weekMap.size;
    const weeklyCounts = Array.from(weekMap.values());
    const weeklyAvg = weeklyCounts.length ? Math.round((weeklyCounts.reduce((a, b) => a + b, 0) / weeklyCounts.length) * 10) / 10 : 0;
    const bestWeek = weeklyCounts.reduce((m, c) => Math.max(m, c), 0);
    // Build a contiguous weekly series from the first Monday within the year to Dec 31 (zeros for missing weeks)
    const jan1 = new Date(goalsYear, 0, 1);
    const yearEnd = new Date(goalsYear, 11, 31);
    let start = weekStartLocal(jan1);
    if (start.getFullYear() < goalsYear) {
      start.setDate(start.getDate() + 7);
    }
    const series: Array<{ date: string; count: number }> = [];
    for (let d = new Date(start); d.getTime() <= yearEnd.getTime(); d.setDate(d.getDate() + 7)) {
      const key = toLocalISO(d);
      series.push({ date: key, count: weekMap.get(key) || 0 });
    }
    const boulderNums = ylogs.filter((l) => l.type === 'boulder').map((l) => vScaleToNumber(l.grade)).filter((n): n is number => n != null);
    const bestBoulder = boulderNums.length ? `V${Math.max(...boulderNums)}` : null;
    const ropeIdxs = ylogs.filter((l) => l.type === 'rope').map((l) => frenchToIndex(l.grade)).filter((n): n is number => n != null);
    const bestRope = ropeIdxs.length ? frenchGrades[Math.max(...ropeIdxs)] : null;
    return { total, flashes, flashRate, avgAttempts, days, weeks, weeklyAvg, bestWeek, bestBoulder, bestRope, series };
  }, [yearLogsByYear, goalsYear]);

  // Generate a transparent PNG overlay for the selected year's summary
  function generateYearSummaryOverlay() {
    const W = 1080, H = 1920; // portrait
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Transparent background only
    ctx.clearRect(0, 0, W, H);
    const title = `Climbing Year ${goalsYear}`;
    const accent = '#fc4c02'; // Strava-like orange
    ctx.textAlign = 'center';
    // Text helpers
    const write = (text: string, size: number, px: number, py: number, bold = false, color = '#ffffff') => {
      ctx.font = `${bold ? '700' : '400'} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
      ctx.fillText(text, px, py);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    };
    const cx = W / 2; const padY = 160;
    // Header
    write(title, 88, cx, padY, true);
    // Primary stat block (big numbers like Strava)
    write(String(yearSummary.total), 140, cx, padY + 160, true, accent);
    write('Total Sends', 44, cx, padY + 210);
    // Secondary stats with label/value styling
    const writePair = (label: string, value: string, size: number, y: number) => {
      const space = 14;
      // Measure widths to center the combined label + value
      ctx.font = `400 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      const labelW = ctx.measureText(label + ': ').width;
      ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      const valueW = ctx.measureText(value).width;
      const totalW = labelW + space + valueW;
      const startX = cx - totalW / 2;
      // Draw label
      ctx.textAlign = 'left';
      ctx.font = `400 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
      ctx.fillText(label + ':', startX, y);
      // Draw value in accent
      ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = accent;
      ctx.fillText(value, startX + labelW + space, y);
      // Reset shadow
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.textAlign = 'center';
    };
    writePair('Flash rate', `${yearSummary.flashRate}%`, 44, padY + 290);
    writePair('Avg attempts', `${yearSummary.avgAttempts}`, 44, padY + 330);
    writePair('Active weeks', `${yearSummary.weeks}`, 44, padY + 370);
    writePair('Weekly avg', `${yearSummary.weeklyAvg}`, 44, padY + 410);
    writePair('Best week', `${yearSummary.bestWeek}`, 44, padY + 450);
    writePair('Days climbed', `${yearSummary.days}`, 44, padY + 490);
    writePair('Best boulder', `${yearSummary.bestBoulder || '—'}`, 44, padY + 530);
    writePair('Best rope', `${yearSummary.bestRope || '—'}`, 44, padY + 570);

    // Inline sparkline of weekly sessions (yearSummary.series)
    if (Array.isArray(yearSummary.series) && yearSummary.series.length) {
      const series = yearSummary.series;
      const sidePad = 96;
      const chartW = W - sidePad * 2; const chartH = 320; const chartX = sidePad; const chartY = padY + 660;
      const max = Math.max(...series.map((s) => s.count));
      const min = Math.min(...series.map((s) => s.count));
      const n = series.length;
      const stepX = n > 1 ? chartW / (n - 1) : chartW;
      const scaleY = (v: number) => chartY + chartH - (max > 0 ? (v / max) * chartH : 0);
      // Draw baseline avg
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      const avgY = scaleY(yearSummary.weeklyAvg);
      ctx.beginPath(); ctx.moveTo(chartX, avgY); ctx.lineTo(chartX + chartW, avgY); ctx.stroke();
      // Spark line
      ctx.strokeStyle = accent; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = chartX + stepX * i;
        const py = scaleY(series[i].count);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Title for chart
      write('Weekly Sessions', 40, cx, chartY - 16, true);
      // Month labels along X (uniform spacing)
      const startD = parseLocalDate(series[0].date);
      const endD = parseLocalDate(series[n - 1].date);
      const startIdx = startD.getFullYear() * 12 + startD.getMonth();
      const endIdx = endD.getFullYear() * 12 + endD.getMonth();
      const count = Math.max(2, endIdx - startIdx + 1);
      ctx.textAlign = 'center';
      for (let i = 0; i < count; i++) {
        const idx = startIdx + i;
        const y = Math.floor(idx / 12);
        const m = idx % 12;
        const label = new Date(y, m, 1).toLocaleString(undefined, { month: 'short' });
        const x = chartX + (i / (count - 1)) * chartW;
        // tick mark
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, chartY + chartH + 14); ctx.lineTo(x, chartY + chartH + 28); ctx.stroke();
        write(label, 32, x, chartY + chartH + 48);
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `climbing-year-${goalsYear}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  // Generate a transparent PNG overlay showing all goals for the selected year
  function generateGoalsYearOverlay() {
    const W = 1080, H = 1920; const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const accent = '#fc4c02';
    ctx.textAlign = 'center';
    const write = (text: string, size: number, px: number, py: number, bold = false, color = '#ffffff') => {
      ctx.font = `${bold ? '700' : '400'} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = color; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
      ctx.fillText(text, px, py);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    };
    const cx = W / 2, padY = 160;
    write(`Year Goals ${goalsYear}`, 88, cx, padY, true);
    const meters = goalsForSelectedYear.slice(0, Math.min(8, goalsForSelectedYear.length));
    if (!meters.length) {
      write('No goals', 60, cx, padY + 120, true, accent);
    } else {
      // summary counts
      const succeeded = meters.filter((g) => g.done >= g.target).length;
      write(`${succeeded}/${meters.length} succeeded`, 48, cx, padY + 140, true, accent);
      // Vertical meters in grid layout (centered, non-overlapping)
      const sidePad = 96;
      const topArea = padY + 220;
      const bottomPad = 160;
      const areaW = W - sidePad * 2;
      const areaH = H - topArea - bottomPad;
      const cols = Math.min(4, Math.max(2, meters.length >= 5 ? 3 : meters.length));
      const rows = Math.max(1, Math.ceil(meters.length / cols));
      const cellW = areaW / cols;
      const cellH = areaH / rows;
      const barW = Math.min(88, Math.max(64, Math.floor(cellW * 0.16)));
      for (let i = 0; i < meters.length; i++) {
        const g = meters[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        const cellX = sidePad + col * cellW;
        const cellY = topArea + row * cellH;
        const centerX = Math.round(cellX + cellW / 2);
        // label above bar
        const titleY = cellY + 28;
        write(`${g.type} • ${g.grade}`, 40, centerX, titleY, true);
        // place meter closer to title (higher in cell)
        const meterTop = titleY + 14;
        const meterBottomLimit = cellY + cellH - 50; // leave space for value
        const maxBarH = Math.max(220, Math.min(420, meterBottomLimit - meterTop));
        const barX = centerX - Math.floor(barW / 2);
        const barTop = meterTop; // align to top to keep meter higher
        const barBottom = Math.min(barTop + maxBarH, meterBottomLimit);
        // background
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(barX, barTop, barW, maxBarH);
        // fill from bottom up
        const fillH = Math.max(0, Math.min(maxBarH, Math.round((g.pct || 0) / 100 * maxBarH)));
        const fillY = barBottom - fillH;
        ctx.fillStyle = accent;
        ctx.fillRect(barX, fillY, barW, fillH);
        // percentage label overlaying the meter (center of bar)
        const pctY = Math.round(barTop + (barBottom - barTop) / 2);
        write(`${g.pct}%`, 34, centerX, pctY, true, accent);
        // horizontal done/target below the meter (clamped into cell)
        const valueY = Math.min(cellY + cellH - 18, barBottom + 40);
        write(`${g.done}/${g.target}`, 36, centerX, valueY, true, '#ffffff');
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `goals-year-${goalsYear}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  const goalLogs = useMemo(() => {
    if (!selectedGoal) return [] as Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>;
    const keyType = selectedGoal.type;
    const keyGrade = normalizeGrade(selectedGoal.type, selectedGoal.grade);
    const logsForYear = yearLogsByYear[selectedGoal.year] || [];
    return logsForYear
      .filter((l) => l.type === keyType && normalizeGrade(l.type, l.grade) === keyGrade)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [yearLogsByYear, selectedGoal]);

  const goalProgressSeries = useMemo(() => {
    if (!selectedGoal) return { series: [] as Array<{ date: string; actual: number; ideal: number; recentPace: number }>, done: 0, recentAvg: 0 };
    const yr = selectedGoal.year;
    const start = new Date(yr, 0, 1);
    const end = new Date(yr, 11, 31);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    let actual = 0;
    const byDay = new Map<string, number>();
    for (const l of goalLogs) {
      const d = toLocalISO(parseLocalDate(l.date));
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    // Recent 6-week weighted average
    const weeklyMap = new Map<string, number>();
    for (const l of goalLogs) {
      const dt = parseLocalDate(l.date);
      const ws = weekStartLocal(dt);
      const key = toLocalISO(ws);
      weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1);
    }
    const weeklySeries = Array.from(weeklyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const lastSix = weeklySeries.slice(-6);
    const weights = lastSix.map((_, i) => i + 1);
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    const recentAvg = lastSix.length ? Math.round((lastSix.reduce((acc, [_, c], i) => acc + c * weights[i], 0) / wsum) * 10) / 10 : 0;
    const series: Array<{ date: string; actual: number; ideal: number; recentPace: number }> = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toLocalISO(d);
      const inc = byDay.get(iso) || 0;
      actual += inc;
      const ideal = Math.round((selectedGoal.target * (i / (totalDays - 1))) * 10) / 10;
      const recentPace = Math.round(((recentAvg * (i / 7))) * 10) / 10;
      series.push({ date: iso, actual, ideal, recentPace });
    }
    return { series, done: actual, recentAvg };
  }, [selectedGoal, goalLogs]);

  const goalWeekly = useMemo(() => {
    if (!selectedGoal) return { series: [] as Array<{ date: string; count: number }>, avg: 0, activeWeeks: 0, bestWeek: 0, byWeekDates: new Map<string, string[]>() };
    const bucketsMap = new Map<string, { date: string; count: number }>();
    const datesMap = new Map<string, string[]>();
    for (const l of goalLogs) {
      const dt = parseLocalDate(l.date);
      const ws = weekStartLocal(dt);
      const key = toLocalISO(ws);
      const b = bucketsMap.get(key) || { date: key, count: 0 };
      b.count += 1;
      bucketsMap.set(key, b);
      const arr = datesMap.get(key) || [];
      arr.push(l.date.slice(0, 10));
      datesMap.set(key, arr);
    }
    const series = Array.from(bucketsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const avg = series.length ? Math.round((series.reduce((a, b) => a + b.count, 0) / series.length) * 10) / 10 : 0;
    const activeWeeks = series.filter((w) => w.count > 0).length;
    const bestWeek = series.reduce((m, w) => Math.max(m, w.count), 0);
    return { series, avg, activeWeeks, bestWeek, byWeekDates: datesMap };
  }, [selectedGoal, goalLogs]);

  const goalFlashPie = useMemo(() => {
    if (!selectedGoal) return { flash: 0, nonFlash: 0 };
    let flash = 0, nonFlash = 0;
    for (const l of goalLogs) { if (l.attempts === 0) flash++; else nonFlash++; }
    return { flash, nonFlash };
  }, [selectedGoal, goalLogs]);

  const goalAttemptsDist = useMemo(() => {
    if (!selectedGoal) return [
      { bucket: '0', count: 0 },
      { bucket: '1', count: 0 },
      { bucket: '2', count: 0 },
      { bucket: '3', count: 0 },
      { bucket: '4+', count: 0 },
    ];
    const buckets = { '0': 0, '1': 0, '2': 0, '3': 0, '4+': 0 } as Record<string, number>;
    for (const l of goalLogs) {
      const a = l.attempts || 0;
      if (a <= 0) buckets['0'] += 1;
      else if (a === 1) buckets['1'] += 1;
      else if (a === 2) buckets['2'] += 1;
      else if (a === 3) buckets['3'] += 1;
      else buckets['4+'] += 1;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  }, [selectedGoal, goalLogs]);

  return (
    <section className="space-y-6">
      {updatedMs ? (<div className="subtle text-xs">Updated at {new Date(updatedMs).toLocaleTimeString()}</div>) : null}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="card-title">Goals ({goalsYear || thisYear})</div>
            <div className="flex items-center gap-2">
              <button className="btn-outline text-xs" disabled={!goalsYears.length || goalsYear === goalsYears[0] || isYearSwitchPending} onClick={() => {
                const idx = goalsYears.indexOf(goalsYear);
                if (idx > 0) startYearSwitchTransition(() => setGoalsYear(goalsYears[idx - 1]));
              }}>{isYearSwitchPending ? '…' : 'Prev'}</button>
              <button className="btn-outline text-xs" disabled={!goalsYears.length || goalsYear === goalsYears[goalsYears.length - 1] || isYearSwitchPending} onClick={() => {
                const idx = goalsYears.indexOf(goalsYear);
                if (idx >= 0 && idx < goalsYears.length - 1) startYearSwitchTransition(() => setGoalsYear(goalsYears[idx + 1]));
              }}>{isYearSwitchPending ? '…' : 'Next'}</button>
            </div>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {goalsForSelectedYear.length ? goalsForSelectedYear.map((g) => (
              <li key={g.id} className="rounded border p-2 cursor-pointer" style={{ borderColor: 'var(--border)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')} onMouseLeave={e => (e.currentTarget.style.background = '')} onClick={() => setSelectedGoal({ id: g.id, year: g.year, type: g.type, grade: g.grade, target: g.target })}>
                <div className="flex items-center justify-between">
                  <span>{g.type} • {g.grade}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--accent)' }}>{g.done}/{g.target}</span>
                    <span className="text-xs">{goalStatusText(g.year, g.done, g.target)}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded" style={{ background: 'var(--surface-alt)' }}>
                  <div className="h-2 rounded bg-(--accent)" style={{ width: `${g.pct}%` }} />
                </div>
                <GoalPaceLine year={g.year} done={g.done} target={g.target} />
              </li>
            )) : <li className="subtle">No goals for {goalsYear || thisYear}</li>}
          </ul>
          <div className="mt-3">
            <div className="font-medium text-center">Year Summary</div>
            {yearSummary.total ? (
              <div className="mt-2 flex items-center justify-center gap-2">
                <button className="btn-outline px-2 py-1 text-xs" onClick={generateYearSummaryOverlay}>Stats overlay</button>
                {goalsForSelectedYear.length ? (
                  <button className="btn-outline px-2 py-1 text-xs" onClick={generateGoalsYearOverlay}>Goals overlay</button>
                ) : null}
              </div>
            ) : null}
            {yearSummary.total ? (
              <>
                <YearSummaryChart series={yearSummary.series} weeklyAvg={yearSummary.weeklyAvg} goalsYear={goalsYear} />
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex justify-between"><span>Total sends</span><span className="subtle">{yearSummary.total}</span></li>
                  <li className="flex justify-between"><span>Flash rate</span><span className="subtle">{yearSummary.flashRate}%</span></li>
                  <li className="flex justify-between"><span>Avg attempts</span><span className="subtle">{yearSummary.avgAttempts}</span></li>
                  <li className="flex justify-between"><span>Active weeks</span><span className="subtle">{yearSummary.weeks}</span></li>
                  <li className="flex justify-between"><span>Weekly avg</span><span className="subtle">{yearSummary.weeklyAvg}</span></li>
                  <li className="flex justify-between"><span>Best week</span><span className="subtle">{yearSummary.bestWeek}</span></li>
                  <li className="flex justify-between"><span>Days climbed</span><span className="subtle">{yearSummary.days}</span></li>
                  <li className="flex justify-between"><span>Best boulder</span><span className="subtle">{yearSummary.bestBoulder || '—'}</span></li>
                  <li className="flex justify-between"><span>Best rope</span><span className="subtle">{yearSummary.bestRope || '—'}</span></li>
                </ul>
              </>
            ) : (
              <div className="subtle mt-2">No logs for this year.</div>
            )}
          </div>
        </div>
        <div className="card p-4">
          <div className="card-title">Last 30 Days</div>
          <div className="text-2xl font-semibold">{stats.total} sends</div>
          <div className="subtle">{stats.flashRate}% flash • avg {stats.avgAttempts} attempts</div>
          <div className="subtle">Boulder trend: {stats.vTrend >= 0 ? '+' : ''}{stats.vTrend} • Rope trend: {stats.ropeTrend >= 0 ? '+' : ''}{stats.ropeTrend}</div>
          <div className="subtle">Attempts trend (30d): {stats.attemptsTrend <= 0 ? 'improving' : 'worse'} ({stats.attemptsTrend})</div>
        </div>
        <div className="card p-4">
          <div className="card-title">Weekly Sessions (12w)</div>
          <div className="mt-2 h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly.series} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis tick={false} axisLine={false} domain={[0, 'auto']} />
                <Tooltip formatter={(v: any) => [String(v), 'Sessions']} labelFormatter={(l: any) => l} />
                <ReferenceLine y={weekly.avg} stroke="var(--border)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1">
            <span className="subtle">Avg: </span>
            <span className="font-medium" style={{ color: 'var(--accent)' }}>{weekly.avg}</span>
            <span className="subtle"> • Active weeks: </span>
            <span className="font-medium" style={{ color: 'var(--accent)' }}>{weekly.activeWeeks}/{weekly.series.length}</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="card-title">Consistency</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--accent)' }}>{consistency.weeksActiveRate}%</div>
          <div>
            <span className="subtle">Weeks active (12w): </span>
            <span className="font-medium" style={{ color: 'var(--accent)' }}>{consistency.weeksActive}/{consistency.weeksTotal}</span>
          </div>
          <div>
            <span className="subtle">Days climbed (7d): </span>
            <span className="font-medium" style={{ color: 'var(--accent)' }}>{consistency.daysLast7}/7</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="card-title">By Grade (30d)</div>
          <ul className="mt-2 space-y-1 text-sm">
            {byGrade30.length ? byGrade30.map((r) => (
              <li key={`${r.type}|${r.grade}`} className="flex justify-between">
                <span>{r.type} • {r.grade}</span>
                <span className="subtle">{r.count} • {r.flashRate}% flash • {r.avgAttempts} att</span>
              </li>
            )) : <li className="subtle">No recent data</li>}
          </ul>
        </div>
        {/* Goal input removed; use /climbing-goals */}
      </div>
      {selectedGoal && (
        <GoalOverlay
          goal={selectedGoal}
          progressSeries={goalProgressSeries.series}
          weeklySeries={goalWeekly.series}
          weeklyAvg={goalWeekly.avg}
          weeklyRecentAvg={goalProgressSeries.recentAvg}
          bestWeek={goalWeekly.bestWeek}
          flashPie={goalFlashPie}
          attemptsDist={goalAttemptsDist}
          goalItems={goalLogs}
          byWeekDates={goalWeekly.byWeekDates}
          allGoalsForYear={goalsForSelectedYear}
          onClose={() => setSelectedGoal(null)}
        />
      )}
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

// All Logs component moved to Climbing Log page

function goalStatusText(year: number, done: number, target: number) {
  const nowYear = new Date().getFullYear();
  const ended = nowYear > year;
  if (done >= target) return '✅ Succeeded';
  if (ended) return '❌ Failed';
  return '⏳ In progress';
}

// GoalOverlay moved to components/GoalOverlay.tsx and loaded dynamically
