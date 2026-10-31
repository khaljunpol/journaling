'use client';

import { useMemo } from 'react';
import { localISO as toLocalISO, parseLocalDate, weekStartLocal } from '@journaling/core/date';
import { normalizeGrade } from '@journaling/core/climbing';
import { goalPace as calcGoalPace, weeklySeries as calcWeeklySeries } from '@journaling/core/climbStats';
import type { ClimbLog } from '@journaling/core/types';

export type SelectedGoal = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

/** Everything the goal popup shows for one goal: its logs, pace, progress lines, weekly bars, flash split. */
export function useGoalDetail(selectedGoal: SelectedGoal | null, yearLogsByYear: Record<number, ClimbLog[]>, today: string) {
  const goalLogs = useMemo(() => {
    if (!selectedGoal) return [] as ClimbLog[];
    const keyType = selectedGoal.type;
    const keyGrade = normalizeGrade(selectedGoal.type, selectedGoal.grade);
    const logsForYear = yearLogsByYear[selectedGoal.year] || [];
    return logsForYear
      .filter((l) => l.type === keyType && normalizeGrade(l.type, l.grade) === keyGrade && l.date.slice(0, 10) <= today)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [yearLogsByYear, selectedGoal, today]);

  // Rest weeks count as 0 (see goalPace / weeklySeries in climbStats).
  const pace = useMemo(
    () => (selectedGoal ? calcGoalPace(selectedGoal, yearLogsByYear[selectedGoal.year] || [], today) : null),
    [selectedGoal, yearLogsByYear, today],
  );

  const progressSeries = useMemo(() => {
    if (!selectedGoal || !pace) return [] as Array<{ date: string; actual: number; ideal: number; recentPace: number }>;
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
      const recentPace = Math.round(((pace.recentPerWeek * (i / 7))) * 10) / 10;
      series.push({ date: iso, actual, ideal, recentPace });
    }
    return series;
  }, [selectedGoal, pace, goalLogs]);

  const weekly = useMemo(() => {
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

  const flashPie = useMemo(() => {
    let flash = 0, nonFlash = 0;
    for (const l of goalLogs) { if (l.attempts === 0) flash++; else nonFlash++; }
    return { flash, nonFlash };
  }, [goalLogs]);

  const attemptsDist = useMemo(() => {
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
  }, [goalLogs]);

  return { goalLogs, pace, progressSeries, weekly, flashPie, attemptsDist };
}
