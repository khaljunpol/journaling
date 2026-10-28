"use client";

import { clearCacheByPrefix, getCache, setCache } from '@/lib/cache';
import { localTodayISO, parseLocalDate, localISO as toLocalISO, weekStartLocal } from '@/lib/date';
import type { ClimbGoal, ClimbLog } from '@/lib/types';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { vScaleToNumber, FRENCH_GRADES, frenchToIndex, normalizeGrade } from '@/lib/climbing';
import { goalPace as calcGoalPace, weeklySeries as calcWeeklySeries, type GoalPace } from '@/lib/climbStats';
import { COLORS } from '@/lib/colors';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Skeleton from '@/components/ui/Skeleton';
import { ToastHost, useToast } from '@/components/ui/Toast';
import GoalSheet from '@/components/climbing/GoalSheet';
import ShareStorySheet, { type StoryStyle } from '@/components/climbing/ShareStorySheet';
import { latestSessionDate } from '@/lib/climbStory';
import LastSession from '@/components/climbing/overview/LastSession';
import StrongerSection from '@/components/climbing/overview/StrongerSection';
import { StrongerSheet, HabitsSheet, CompareSheet, GymsSheet } from '@/components/climbing/overview/StatSheets';
import EnoughSection from '@/components/climbing/overview/EnoughSection';
import Answer from '@/components/climbing/overview/Answer';
import { QUESTION_CLASS, type DetailKind } from '@/components/climbing/overview/types';

const GoalOverlay = dynamic(() => import('./GoalOverlay'), { ssr: false });

export default function ClimbingView() {
  const today = useMemo(() => localTodayISO(), []);
  const [goals, setGoals] = useState<Array<ClimbGoal>>([]);
  // Every climb, loaded once; the per-year lists below are derived from it.
  const [allLogs, setAllLogs] = useState<Array<ClimbLog>>([]);
  // Share sheet opened from the year card (Year or Goals image), null when closed
  const [storyStyle, setStoryStyle] = useState<StoryStyle | null>(null);
  // Date the share sheet opens on (the last session strip); null = the shown year's latest session
  const [storyDate, setStoryDate] = useState<string | null>(null);
  // Which detail sheet was asked for. Task 6 renders them.
  const [detail, setDetail] = useState<DetailKind | null>(null);
  // Goal sheet (new goal from the card; the overlay owns its own edit sheet)
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<{ id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const [isYearSwitchPending, startYearSwitchTransition] = useTransition();
  const { show } = useToast();
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();
      // Apply cached immediately where available
      const goalsKey = 'climb:goals';
      const cachedGoals = getCache<typeof goals>(goalsKey);
      if (cachedGoals) setGoals(Array.isArray(cachedGoals.data) ? cachedGoals.data : []);
      const goalsResp = await fetch('/api/climbing/goals', { signal: ctrlRef.current.signal });
      if (!goalsResp.ok) throw new Error('goals failed');
      const gs: Array<ClimbGoal> = await goalsResp.json();
      const goalsArr = Array.isArray(gs) ? gs : [];
      // The year we wanted to stay on has no goals left: let the normal year pick run.
      if (pendingYearRef.current != null && !goalsArr.some((g) => g.year === pendingYearRef.current)) pendingYearRef.current = null;
      setGoals(goalsArr);
      try { setCache(goalsKey, goalsArr); } catch { }
      // One fetch for every climb (cached 5 minutes); years, streaks and bests are derived from it
      const ALL_CACHE_TTL_MS = 5 * 60 * 1000;
      const allKey = 'climb:year:all';
      const cachedAll = getCache<Array<ClimbLog>>(allKey);
      let fresh = false;
      if (cachedAll) { try { fresh = (Date.now() - Date.parse(cachedAll.cachedAt)) < ALL_CACHE_TTL_MS; } catch { fresh = false; } }
      if (fresh && cachedAll) {
        setAllLogs(Array.isArray(cachedAll.data) ? cachedAll.data : []);
      } else {
        const resp = await fetch('/api/climbing/logs');
        if (!resp.ok) throw new Error('logs failed');
        const items: Array<ClimbLog> = await resp.json();
        const arr = Array.isArray(items) ? items : [];
        setAllLogs(arr);
        try { setCache(allKey, arr); } catch { }
      }
      setLoaded(true);
    } catch (e) {
      pendingYearRef.current = null;
      if (!(e instanceof DOMException && e.name === 'AbortError')) show("Couldn't load your climbs.");
      setLoaded(true);
    }
  }

  useEffect(() => { refresh(); }, []);

  /** After a goal is saved or deleted: drop the cached year logs so counts are fresh, then reload. */
  function onGoalsChanged(savedYear?: number) {
    clearCacheByPrefix('climb:year:');
    try { localStorage.removeItem('climb:goals'); } catch { }
    if (savedYear != null) { pendingYearRef.current = savedYear; setGoalsYear(savedYear); }
    void refresh();
  }

  const thisYear = new Date().getFullYear();
  const yearLogsByYear = useMemo(() => {
    const map: Record<number, Array<ClimbLog>> = {};
    for (const l of allLogs) {
      const y = parseInt(l.date.slice(0, 4), 10);
      if (Number.isFinite(y)) (map[y] ||= []).push(l);
    }
    return map;
  }, [allLogs]);

  const goalsProgress = useMemo(() => {
    return goals.map((g) => {
      const pace = calcGoalPace(g, yearLogsByYear[g.year] || [], today);
      const pct = g.target ? Math.min(100, Math.round((pace.done / g.target) * 100)) : 0;
      return { ...g, done: pace.done, pct, pace };
    });
  }, [goals, yearLogsByYear, today]);

  const [goalsYear, setGoalsYear] = useState<number>(thisYear);
  const pendingYearRef = useRef<number | null>(null);
  const goalsYears = useMemo(() => {
    const set = new Set(goalsProgress.map((g) => g.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [goalsProgress]);
  useEffect(() => {
    if (goalsYears.length === 0) return;
    // Just saved a goal: stay on its year once the fresh goals arrive.
    if (pendingYearRef.current != null && goalsYears.includes(pendingYearRef.current)) {
      setGoalsYear(pendingYearRef.current);
      pendingYearRef.current = null;
      return;
    }
    if (pendingYearRef.current != null) return;
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
    // Weekly average counts rest weeks as 0 (same as weeklySeries / sendsPerWeek), up to today or the year's end.
    const yJan1 = `${goalsYear}-01-01`;
    const yDec31 = `${goalsYear}-12-31`;
    const avgEnd = today < yJan1 ? yJan1 : today > yDec31 ? yDec31 : today;
    const avgSeries = calcWeeklySeries(ylogs, yJan1, avgEnd);
    const weeklyAvg = avgSeries.length ? Math.round((avgSeries.reduce((a, w) => a + w.count, 0) / avgSeries.length) * 10) / 10 : 0;
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
  }, [yearLogsByYear, goalsYear, today]);

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
      .filter((l) => l.type === keyType && normalizeGrade(l.type, l.grade) === keyGrade && l.date.slice(0, 10) <= today)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [yearLogsByYear, selectedGoal, today]);

  // Pace for the open goal: rest weeks count as 0 (see goalPace / weeklySeries in climbStats).
  const selectedPace = useMemo(
    () => (selectedGoal ? calcGoalPace(selectedGoal, yearLogsByYear[selectedGoal.year] || [], today) : null),
    [selectedGoal, yearLogsByYear, today],
  );

  const goalProgressSeries = useMemo(() => {
    if (!selectedGoal || !selectedPace) return [] as Array<{ date: string; actual: number; ideal: number; recentPace: number }>;
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
    const series: Array<{ date: string; actual: number; ideal: number; recentPace: number }> = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toLocalISO(d);
      actual += byDay.get(iso) || 0;
      const ideal = Math.round((selectedGoal.target * (i / (totalDays - 1))) * 10) / 10;
      const recentPace = Math.round(((selectedPace.recentPerWeek * (i / 7))) * 10) / 10;
      series.push({ date: iso, actual, ideal, recentPace });
    }
    return series;
  }, [selectedGoal, selectedPace, goalLogs]);

  const goalWeekly = useMemo(() => {
    if (!selectedGoal) return { series: [] as Array<{ date: string; count: number }>, avg: 0, bestWeek: 0, byWeekDates: new Map<string, string[]>() };
    const yr = selectedGoal.year;
    const jan1 = `${yr}-01-01`;
    const dec31 = `${yr}-12-31`;
    const upto = today > dec31 ? dec31 : today < jan1 ? jan1 : today;
    // Every week from 1 Jan up to now (or Dec 31), zeros included.
    const series = calcWeeklySeries(goalLogs, jan1, upto).map((w) => ({ date: w.start, count: w.count }));
    const datesMap = new Map<string, string[]>();
    for (const l of goalLogs) {
      const key = toLocalISO(weekStartLocal(parseLocalDate(l.date)));
      const arr = datesMap.get(key) || [];
      arr.push(l.date.slice(0, 10));
      datesMap.set(key, arr);
    }
    const avg = series.length ? Math.round((series.reduce((a, w) => a + w.count, 0) / series.length) * 10) / 10 : 0;
    const bestWeek = series.reduce((m, w) => Math.max(m, w.count), 0);
    return { series, avg, bestWeek, byWeekDates: datesMap };
  }, [selectedGoal, goalLogs, today]);

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

  // Years the switcher can show: goal years, loaded years that have climbs, and this year.
  const years = useMemo(() => {
    const set = new Set<number>([thisYear, ...goalsYears]);
    for (const y of Object.keys(yearLogsByYear)) set.add(Number(y));
    return Array.from(set).sort((a, b) => a - b);
  }, [yearLogsByYear, goalsYears, thisYear]);
  const shownYearLogs = yearLogsByYear[goalsYear] || [];
  // "Now" for the shown year: today, or the end of a past year (start of a future one).
  const asOf = goalsYear === thisYear ? today : goalsYear > thisYear ? `${goalsYear}-01-01` : `${goalsYear}-12-31`;
  const goalsSummary = useMemo(() => {
    if (goalsForSelectedYear.length === 0) return `No goals for ${goalsYear}`;
    const open = goalsForSelectedYear.filter((g) => !g.pace.ended);
    if (open.length === 0) return `${goalsForSelectedYear.filter((g) => g.done >= g.target).length} of ${goalsForSelectedYear.length} goals reached`;
    const onTrack = open.filter((g) => g.done >= g.target || g.pace.notStarted || g.pace.onTrack).length;
    return `${onTrack} of ${open.length} goals on track`;
  }, [goalsForSelectedYear, goalsYear]);
  const yearIdx = years.indexOf(goalsYear);
  const openDetail = (kind: DetailKind) => setDetail(kind);
  const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-40';

  return (
    <section className="space-y-3 sm:space-y-4">
      {/* ── Header: year switcher and Share ────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous year"
          className={iconBtn}
          style={{ color: 'var(--text-1)' }}
          disabled={yearIdx <= 0 || isYearSwitchPending}
          onClick={() => startYearSwitchTransition(() => setGoalsYear(years[yearIdx - 1]))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="num min-w-12 text-center text-[18px] font-semibold" style={{ color: 'var(--text-1)' }}>{goalsYear}</h2>
        <button
          type="button"
          aria-label="Next year"
          className={iconBtn}
          style={{ color: 'var(--text-1)' }}
          disabled={yearIdx < 0 || yearIdx >= years.length - 1 || isYearSwitchPending}
          onClick={() => startYearSwitchTransition(() => setGoalsYear(years[yearIdx + 1]))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <Button small variant="outline" className="ml-auto" onClick={() => { setStoryDate(null); setStoryStyle('year'); }}>Share</Button>
      </div>

      {!loaded ? (
        <Card><Skeleton className="h-6 w-2/3" /></Card>
      ) : (
        <LastSession logs={allLogs} onShare={(d) => { setStoryDate(d); setStoryStyle('story'); }} />
      )}

      {loaded ? <StrongerSection logs={shownYearLogs} year={goalsYear} onOpen={openDetail} /> : <Card><Skeleton className="h-28 w-full" /></Card>}

      {/* ── Sections 2 and 3, side by side from 1024 px ────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        {/* ── Am I on track? ─────────────────────────────────── */}
        <Card>
          <div className="flex items-center gap-2">
            <h3 className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>Am I on track?</h3>
            <Button small variant="outline" className="ml-auto" onClick={() => setGoalSheetOpen(true)}><Plus size={16} aria-hidden="true" />Goal</Button>
          </div>
          <Answer className="mb-3" parts={[goalsSummary.split(/(\d+)/).map((t, i) => (i % 2 ? <span key={i} className="num">{t}</span> : t))]} />
          {goalsForSelectedYear.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {goalsForSelectedYear.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="block min-h-11 w-full rounded-[10px] p-3 text-left hover:brightness-110"
                    style={{ background: 'var(--surface-2)' }}
                    onClick={() => setSelectedGoal({ id: g.id, year: g.year, type: g.type, grade: g.grade, target: g.target })}
                    aria-label={`${g.grade} ${g.type} goal, ${g.done} of ${g.target}. Open details`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Chip tone="accent">{g.type}</Chip>
                        <span className="num text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{g.grade}</span>
                      </div>
                      <span className="num text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>
                        {g.done}<span className="text-[13px] font-normal" style={{ color: 'var(--text-2)' }}>/{g.target}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${g.pct}%`, background: g.done >= g.target ? 'var(--reward)' : 'var(--accent)' }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
                      <span className="num" style={g.done >= g.target ? { color: 'var(--reward-text)' } : undefined}>{g.pct}%</span>
                      <GoalPaceLine pace={g.pace} done={g.done >= g.target} year={g.year} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {loaded ? (
          <EnoughSection allLogs={allLogs} yearLogs={shownYearLogs} year={goalsYear} asOf={asOf} onOpen={openDetail} />
        ) : (
          <Card><Skeleton className="h-28 w-full" /></Card>
        )}
      </div>

      {/* ── Links to the bigger picture ────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="flex min-h-11 items-center px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={() => openDetail('compare')}>This year vs last ›</button>
        <button type="button" className="flex min-h-11 items-center px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={() => openDetail('gyms')}>Gyms ›</button>
      </div>

      <StrongerSheet open={detail === 'stronger'} onClose={() => setDetail(null)} allLogs={allLogs} yearLogs={shownYearLogs} year={goalsYear} />
      <HabitsSheet open={detail === 'habits'} onClose={() => setDetail(null)} allLogs={allLogs} yearLogs={shownYearLogs} year={goalsYear} today={today} />
      <CompareSheet open={detail === 'compare'} onClose={() => setDetail(null)} allLogs={allLogs} year={goalsYear} asOf={asOf} />
      <GymsSheet open={detail === 'gyms'} onClose={() => setDetail(null)} yearLogs={shownYearLogs} year={goalsYear} />

      <ShareStorySheet
        key={`${storyStyle ?? 'closed'}-${goalsYear}-${storyDate ?? ''}`}
        open={storyStyle !== null}
        onClose={() => setStoryStyle(null)}
        goals={goals}
        initialDate={storyDate ?? latestSessionDate(yearLogsByYear[goalsYear] || []) ?? (goalsYear === thisYear ? today : `${goalsYear}-12-31`)}
        moreStyles={[
          { label: 'Year (old)', run: generateYearSummaryOverlay },
          ...(goalsForSelectedYear.length ? [{ label: 'Goals (old)', run: generateGoalsYearOverlay }] : []),
        ]}
        initialStyle={storyStyle ?? 'year'}
        knownLogs={yearLogsByYear}
      />

      {selectedGoal && (
        <GoalOverlay
          goal={selectedGoal}
          pace={selectedPace!}
          progressSeries={goalProgressSeries}
          weeklySeries={goalWeekly.series}
          weeklyAvg={goalWeekly.avg}
          bestWeek={goalWeekly.bestWeek}
          flashPie={goalFlashPie}
          attemptsDist={goalAttemptsDist}
          goalItems={goalLogs}
          byWeekDates={goalWeekly.byWeekDates}
          allGoalsForYear={goalsForSelectedYear}
          storyGoals={goals}
          storyLogs={yearLogsByYear}
          onClose={() => setSelectedGoal(null)}
          onChanged={onGoalsChanged}
        />
      )}

      <GoalSheet open={goalSheetOpen} onClose={() => setGoalSheetOpen(false)} goals={goals} onSaved={onGoalsChanged} />
      <ToastHost />
    </section>
  );
}

function GoalPaceLine({ pace, done, year }: { pace: GoalPace; done: boolean; year: number }) {
  if (done) return <span className="text-[13px] font-medium" style={{ color: 'var(--reward-text)' }}>Done</span>;
  if (pace.ended) return <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>Ended · {pace.done}/{pace.target}</span>;
  if (pace.notStarted) return <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>Starts {year} · {pace.neededPerWeek}/wk</span>;
  return (
    <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>
      {pace.neededPerWeek}/wk needed · {pace.onTrack ? 'on track' : 'behind pace'}
    </span>
  );
}
