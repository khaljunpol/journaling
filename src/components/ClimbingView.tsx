"use client";

import { getCache, setCache } from '@/lib/cache';
import { localTodayISO, parseLocalDate, localISO as toLocalISO, weekStartLocal } from '@/lib/date';
import type { ClimbGoal, ClimbLog } from '@/lib/types';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { vScaleToNumber, BOULDER_GRADES, FRENCH_GRADES, frenchToIndex, normalizeGrade } from '@/lib/climbing';
import { COLORS } from '@/lib/colors';

const GoalOverlay = dynamic(() => import('./GoalOverlay'), { ssr: false });
const YearSummaryChart = dynamic(() => import('./YearSummaryChart'), { ssr: false });

export default function ClimbingView() {
  const today = useMemo(() => localTodayISO(), []);
  const [date, setDate] = useState<string>(today);
  const [logs, setLogs] = useState<Array<ClimbLog>>([]);
  const [rangeLogs, setRangeLogs] = useState<Array<ClimbLog>>([]);
  const [goals, setGoals] = useState<Array<ClimbGoal>>([]);
  const [yearLogs, setYearLogs] = useState<Array<ClimbLog>>([]);
  const [yearLogsByYear, setYearLogsByYear] = useState<Record<number, Array<ClimbLog>>>({});
  const [selectedGoal, setSelectedGoal] = useState<{ id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const yearCacheRef = useRef<Map<string, Array<{ id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }>>>(new Map());
  const [isYearSwitchPending, startYearSwitchTransition] = useTransition();
  const [updatedMs, setUpdatedMs] = useState<number | null>(null);

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
      const dayKey = `climb:day:${date}`;
      const goalsKey = 'climb:goals';
      const rangeKey = `climb:range:${fromISO}|${toISO}`;
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
        fetch(`/api/climbing/logs?date=${date}`, { signal: ctrlRef.current.signal }),
        fetch('/api/climbing/goals'),
        fetch(`/api/climbing/logs?from=${fromISO}&to=${toISO}`),
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
      const gYears = Array.isArray(gs) ? Array.from(new Set(gs.map((g) => g.year))) : [];
      if (gYears.length) {
        const YEAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes freshness window
        const entries = await Promise.all(gYears.map(async (yr: number) => {
          const cacheKey = String(yr);
          // Prefer localStorage cache if fresh; otherwise fetch
          const lsKey = `climb:year:${yr}`;
          const cached = getCache<Array<ClimbLog>>(lsKey);
          const isFresh = cached && (() => { try { return (Date.now() - Date.parse(cached.cachedAt)) < YEAR_CACHE_TTL_MS; } catch { return false; } })();
          if (isFresh && cached) {
            const arr = Array.isArray(cached.data) ? cached.data : [];
            yearCacheRef.current.set(cacheKey, arr);
            return [yr, arr] as const;
          }
          const yrStart = `${yr}-01-01`;
          const yrEnd = `${yr}-12-31`;
          const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}`);
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

  useEffect(() => { refresh(); }, [date]);

  async function removeLog(id: string) {
    await fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    const bestRope = ropeIdxs.length ? FRENCH_GRADES[Math.max(...ropeIdxs)] : null;
    return { total, flashes, flashRate, avgAttempts, days, weeks, weeklyAvg, bestWeek, bestBoulder, bestRope, series };
  }, [yearLogsByYear, goalsYear]);

  // ── Shared canvas helpers ──
  function createOverlayCanvas() {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    const font = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
    const accent = COLORS.accent;
    const green = COLORS.success;
    const muted = '#ffffff';
    const dim = 'rgba(255,255,255,0.85)';
    const shadow = () => { c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 28; c.shadowOffsetX = 0; c.shadowOffsetY = 2; };
    const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };
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
    return { canvas, c, W, H, write, accent, green, muted, dim, shadow, noShadow, download };
  }

  function drawProgressRing(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, pct: number, accent: string, green: string) {
    // Background ring
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 16; c.stroke();
    // Progress arc
    const start = -Math.PI / 2;
    c.beginPath(); c.arc(cx, cy, r, start, start + Math.PI * 2 * Math.min(1, pct / 100));
    c.strokeStyle = pct >= 100 ? green : accent;
    c.lineWidth = 16; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
  }

  // Generate a transparent PNG overlay for the selected year's summary
  function generateYearSummaryOverlay() {
    const { canvas, c, W, H, write, accent, green, muted, shadow, noShadow, download } = createOverlayCanvas();
    if (!c) return;
    const cx = W / 2;

    // ── Bottom-half layout (leaves top for photo) ──
    const baseY = H * 0.42;

    // Year title
    write(`${goalsYear}`, 48, cx, baseY, { color: muted });
    write('CLIMBING YEAR', 72, cx, baseY + 70, { bold: true });

    // Big number
    write(String(yearSummary.total), 160, cx, baseY + 230, { bold: true, color: accent });
    write('TOTAL SENDS', 32, cx, baseY + 270, { color: muted });

    // Stats grid (2 cols x 4 rows)
    const stats = [
      { label: 'FLASH RATE', value: `${yearSummary.flashRate}%` },
      { label: 'AVG ATTEMPTS', value: `${yearSummary.avgAttempts}` },
      { label: 'DAYS CLIMBED', value: `${yearSummary.days}` },
      { label: 'ACTIVE WEEKS', value: `${yearSummary.weeks}` },
      { label: 'WEEKLY AVG', value: `${yearSummary.weeklyAvg}` },
      { label: 'BEST WEEK', value: `${yearSummary.bestWeek}` },
      { label: 'BEST BOULDER', value: yearSummary.bestBoulder || '—' },
      { label: 'BEST ROPE', value: yearSummary.bestRope || '—' },
    ];
    const gridY = baseY + 340;
    const colW = W / 2;
    const rowH = 100;
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = colW * col + colW / 2;
      const sy = gridY + row * rowH;
      write(s.value, 52, sx, sy, { bold: true });
      write(s.label, 22, sx, sy + 34, { color: muted });
    });

    // Sparkline at bottom
    if (yearSummary.series.length > 1) {
      const series = yearSummary.series;
      const padX = 96;
      const chartX = padX; const chartW = W - padX * 2;
      const chartY = gridY + rowH * 4 + 40; const chartH = 180;
      const max = Math.max(...series.map(s => s.count), 1);
      const n = series.length;
      const stepX = chartW / (n - 1);

      // Filled area
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const px = chartX + stepX * i;
        const py = chartY + chartH - (series[i].count / max) * chartH;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.lineTo(chartX + chartW, chartY + chartH);
      c.lineTo(chartX, chartY + chartH);
      c.closePath();
      c.fillStyle = `${accent}30`;
      c.fill();

      // Line on top
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const px = chartX + stepX * i;
        const py = chartY + chartH - (series[i].count / max) * chartH;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.strokeStyle = accent; c.lineWidth = 4; shadow(); c.stroke(); noShadow();

      write('WEEKLY ACTIVITY', 24, cx, chartY - 12, { color: muted });
    }

    download(`climbing-year-${goalsYear}.png`);
  }

  // Generate a transparent PNG overlay showing all goals for the selected year
  function generateGoalsYearOverlay() {
    const { c, W, H, write, accent, green, muted, shadow, noShadow, download } = createOverlayCanvas();
    if (!c) return;
    const cx = W / 2;
    const goals = goalsForSelectedYear.slice(0, 6);

    // Title area
    const baseY = H * 0.38;
    write(`${goalsYear}`, 48, cx, baseY, { color: muted });
    write('CLIMBING GOALS', 72, cx, baseY + 70, { bold: true });

    const succeeded = goals.filter(g => g.done >= g.target).length;
    write(`${succeeded}/${goals.length} completed`, 36, cx, baseY + 120, { color: succeeded === goals.length ? green : accent });

    if (!goals.length) {
      write('No goals set', 48, cx, baseY + 200, { color: muted });
      download(`goals-${goalsYear}.png`);
      return;
    }

    // Goal rings in a row
    const ringY = baseY + 280;
    const maxPerRow = Math.min(goals.length, 3);
    const rows = Math.ceil(goals.length / maxPerRow);
    const ringR = goals.length <= 3 ? 90 : 70;
    const ringSpacing = W / (maxPerRow + 1);
    const rowSpacing = ringR * 2 + 120;

    goals.forEach((g, i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const colsInRow = row < rows - 1 ? maxPerRow : goals.length - row * maxPerRow;
      const rowOffset = (W - ringSpacing * (colsInRow - 1)) / 2;
      const gx = colsInRow === 1 ? cx : rowOffset + col * ringSpacing;
      const gy = ringY + row * rowSpacing;

      drawProgressRing(c, gx, gy, ringR, g.pct, accent, green);

      // Percentage in center
      write(`${g.pct}%`, ringR > 80 ? 48 : 36, gx, gy + (ringR > 80 ? 8 : 6), { bold: true, color: g.pct >= 100 ? green : accent });
      write(`${g.done}/${g.target}`, ringR > 80 ? 24 : 20, gx, gy + (ringR > 80 ? 40 : 30), { color: muted });

      // Label below ring
      write(g.grade.toUpperCase(), 36, gx, gy + ringR + 40, { bold: true });
      write(g.type.toUpperCase(), 20, gx, gy + ringR + 68, { color: muted });
    });

    download(`goals-${goalsYear}.png`);
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

  const todayBestGrade = useMemo(() => {
    const vNums = logs.filter(l => l.type === 'boulder').map(l => vScaleToNumber(l.grade)).filter((n): n is number => n != null);
    if (vNums.length) return `V${Math.max(...vNums)}`;
    const rIdxs = logs.filter(l => l.type === 'rope').map(l => frenchToIndex(l.grade)).filter((n): n is number => n != null);
    if (rIdxs.length) return FRENCH_GRADES[Math.max(...rIdxs)];
    return '—';
  }, [logs]);

  const todayFlashes = useMemo(() => logs.filter(l => l.attempts === 0).length, [logs]);

  return (
    <section className="space-y-5">

      {/* Page header with log button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Climbing</h2>
        <a href="/climbing-log" className="btn text-sm px-4 py-2">+ Log Climb</a>
      </div>

      {/* ── TODAY'S SESSION ────────────────────────────────────── */}
      {logs.length > 0 && (
        <div className="card overflow-hidden">
          {/* Hero header with accent background */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}>
            <div>
              <div className="text-sm font-medium opacity-80">Today&apos;s Session</div>
              <div className="text-lg font-bold">
                {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <a href="/climbing-log" className="text-xs font-medium px-3 py-1.5 rounded-full active:scale-95" style={{ background: 'rgba(255,255,255,0.2)', color: 'inherit' }}>
              Full log →
            </a>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-4 divide-x" style={{ borderColor: 'var(--border)' }}>
            {[
              { label: 'Sends', value: logs.length },
              { label: 'Sessions', value: sessionsToday },
              { label: 'Flashes', value: todayFlashes },
              { label: 'Best', value: todayBestGrade, accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} className="py-3 text-center" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xl font-bold" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Log entries */}
          <div className="px-4 py-3 space-y-1.5">
            {logs.map(l => (
              <div key={l.id} className="flex items-center gap-3 text-sm py-1.5">
                <span className="font-bold text-base" style={{ color: 'var(--accent)', minWidth: 32 }}>{l.grade}</span>
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {l.type} · S{l.session} · {l.attempts === 0 ? 'flash ⚡' : `${l.attempts} att`}
                  {l.location ? ` · ${l.location}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GOALS ─────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Goals</h2>
          <div className="flex items-center gap-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors active:scale-95"
              style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
              disabled={!goalsYears.length || goalsYear === goalsYears[0] || isYearSwitchPending}
              onClick={() => { const idx = goalsYears.indexOf(goalsYear); if (idx > 0) startYearSwitchTransition(() => setGoalsYear(goalsYears[idx - 1])); }}
            >←</button>
            <span className="text-sm font-medium min-w-[48px] text-center">{goalsYear}</span>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors active:scale-95"
              style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
              disabled={!goalsYears.length || goalsYear === goalsYears[goalsYears.length - 1] || isYearSwitchPending}
              onClick={() => { const idx = goalsYears.indexOf(goalsYear); if (idx >= 0 && idx < goalsYears.length - 1) startYearSwitchTransition(() => setGoalsYear(goalsYears[idx + 1])); }}
            >→</button>
          </div>
        </div>

        {goalsForSelectedYear.length ? (
          <div className="space-y-2">
            {goalsForSelectedYear.map((g) => (
              <button
                key={g.id}
                className="w-full text-left rounded-xl p-3 transition-colors active:scale-[0.99]"
                style={{ background: 'var(--surface-alt)' }}
                onClick={() => setSelectedGoal({ id: g.id, year: g.year, type: g.type, grade: g.grade, target: g.target })}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `var(--accent)22`, color: 'var(--accent)' }}>
                      {g.type}
                    </span>
                    <span className="font-semibold">{g.grade}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{g.done}<span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>/{g.target}</span></span>
                    <span className="text-xs">{goalStatusText(g.year, g.done, g.target)}</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${g.pct}%`, background: g.pct >= 100 ? COLORS.success : 'var(--accent)' }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{g.pct}% complete</span>
                  <GoalPaceLine year={g.year} done={g.done} target={g.target} />
                </div>
              </button>
            ))}
          </div>
        ) : <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No goals for {goalsYear}</p>}
      </div>

      {/* ── YEAR ACTIVITY ─────────────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{goalsYear} Activity</h2>
          {yearSummary.total ? (
            <div className="flex items-center gap-2">
              <button className="btn-outline px-3 py-1.5 text-xs active:scale-95" onClick={generateYearSummaryOverlay}>Share</button>
              {goalsForSelectedYear.length ? (
                <button className="btn-outline px-3 py-1.5 text-xs active:scale-95" onClick={generateGoalsYearOverlay}>Goals</button>
              ) : null}
            </div>
          ) : null}
        </div>

        {yearSummary.total ? (
          <>
            {/* Weekly sends chart — green = above avg, gray = below */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Weekly sends</span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS.success }} />above avg
                  <span className="inline-block w-2 h-2 rounded-full ml-2 mr-1" style={{ background: 'var(--border)' }} />below
                </span>
              </div>
              <YearSummaryChart series={yearSummary.series} weeklyAvg={yearSummary.weeklyAvg} goalsYear={goalsYear} />
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Total sends', value: String(yearSummary.total) },
                { label: 'Flash rate', value: `${yearSummary.flashRate}%` },
                { label: 'Days climbed', value: String(yearSummary.days) },
                { label: 'Active weeks', value: String(yearSummary.weeks) },
                { label: 'Weekly avg', value: String(yearSummary.weeklyAvg) },
                { label: 'Best week', value: String(yearSummary.bestWeek) },
                { label: 'Best boulder', value: yearSummary.bestBoulder || '—', accent: true },
                { label: 'Best rope', value: yearSummary.bestRope || '—', accent: true },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-alt)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
                  <div className="text-lg font-bold mt-0.5" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No climbing data for {goalsYear}.</p>
        )}
      </div>

      {/* ── 30-DAY TRENDS ─────────────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <h2 className="text-base font-semibold">Last 30 Days</h2>

        {/* Headline stats */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold">{stats.total}</span>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>sends</span>
          {stats.flashRate > 0 && (
            <span className="text-sm font-medium px-2 py-0.5 rounded-full" style={{ background: `${COLORS.success}22`, color: COLORS.success }}>
              {stats.flashRate}% flash
            </span>
          )}
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>avg {stats.avgAttempts} attempts</span>
        </div>

        {/* Trend indicators */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Boulder', value: stats.vTrend, suffix: ' grades' },
            { label: 'Rope', value: stats.ropeTrend, suffix: ' grades' },
            { label: 'Attempts', value: -stats.attemptsTrend, suffix: '' },
          ].map(({ label, value, suffix }) => {
            const positive = value > 0;
            const neutral = value === 0;
            return (
              <span
                key={label}
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  background: neutral ? 'var(--surface-alt)' : positive ? `${COLORS.success}18` : `${COLORS.danger}18`,
                  color: neutral ? 'var(--muted-foreground)' : positive ? COLORS.success : COLORS.danger,
                }}
              >
                {label}: {value > 0 ? '+' : ''}{value}{suffix} {positive ? '↑' : neutral ? '—' : '↓'}
              </span>
            );
          })}
        </div>

        {/* Weekly sessions mini chart */}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Weekly Sessions (12w)</span>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span>Avg <strong style={{ color: 'var(--accent)' }}>{weekly.avg}</strong>/wk</span>
              <span>Active <strong style={{ color: 'var(--accent)' }}>{weekly.activeWeeks}</strong>/{weekly.series.length}w</span>
            </div>
          </div>
          <div className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly.series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  cursor={{ stroke: 'var(--border)' }}
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    return (
                      <div className="rounded-xl px-3 py-1.5 text-xs shadow-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                        <span className="font-medium">Week of {label}</span> · {payload[0]?.value} sends
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={weekly.avg} stroke="var(--border)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="count" stroke={COLORS.success} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── BY GRADE ──────────────────────────────────────────── */}
      {byGrade30.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="text-base font-semibold">Grade Breakdown (30d)</h2>
          <div className="space-y-2">
            {byGrade30.map((r) => {
              const maxCount = byGrade30[0]?.count || 1;
              const barPct = Math.round((r.count / maxCount) * 100);
              return (
                <div key={`${r.type}|${r.grade}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>{r.grade}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <span><strong style={{ color: 'var(--text)' }}>{r.count}</strong> sends</span>
                      <span>{r.flashRate}% flash</span>
                      <span>{r.avgAttempts} avg att</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  if (done >= target) return <span className="text-xs" style={{ color: COLORS.success }}>Complete!</span>;
  return <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{perWeek}/wk needed</span>;
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
