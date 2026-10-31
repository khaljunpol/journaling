"use client";

import { localTodayISO } from '@journaling/core/date';
import type { ClimbLog } from '@journaling/core/types';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { goalPace as calcGoalPace } from '@journaling/core/climbStats';
import { useFirstVisit } from '@/components/ui/useFirstVisit';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { ToastHost, useToast } from '@/components/ui/Toast';
import GoalSheet from '@/components/climbing/GoalSheet';
import ShareStorySheet, { type StoryStyle } from '@/components/climbing/ShareStorySheet';
import { latestSessionDate } from '@/lib/climbStory';
import LastSession from '@/components/climbing/overview/LastSession';
import StrongerSection from '@/components/climbing/overview/StrongerSection';
import { StrongerSheet, HabitsSheet, CompareSheet, GymsSheet } from '@/components/climbing/overview/StatSheets';
import EnoughSection from '@/components/climbing/overview/EnoughSection';
import GoalsSection from '@/components/climbing/overview/GoalsSection';
import { type DetailKind } from '@/components/climbing/overview/types';
import { useClimbingData } from '@/components/climbing/useClimbingData';
import { useGoalDetail, type SelectedGoal } from '@/components/climbing/useGoalDetail';
import { downloadGoalsOverlay, downloadYearOverlay } from '@/components/climbing/oldOverlays';

const GoalOverlay = dynamic(() => import('./GoalOverlay'), { ssr: false });

export default function ClimbingView() {
  const animate = useFirstVisit('climbing:entered');
  // Entrance once per tab: index n steps the delay by 40 ms. Never blocks taps.
  const enter = (i: number, extra = ''): { className: string; style: CSSProperties } => ({ className: `${animate ? 'ov-in ' : ''}${extra}`.trim(), style: { '--i': i } as CSSProperties });
  const today = useMemo(() => localTodayISO(), []);
  const thisYear = new Date().getFullYear();
  // Share sheet opened from the header (Year or Goals image), null when closed
  const [storyStyle, setStoryStyle] = useState<StoryStyle | null>(null);
  // Date the share sheet opens on (the last session strip); null = the shown year's latest session
  const [storyDate, setStoryDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailKind | null>(null);
  // Goal sheet (new goal from the card; the overlay owns its own edit sheet)
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SelectedGoal | null>(null);
  const [goalsYear, setGoalsYear] = useState<number>(thisYear);
  // Year to stay on after a goal is saved, until the fresh goals arrive.
  const pendingYearRef = useRef<number | null>(null);
  const [isYearSwitchPending, startYearSwitchTransition] = useTransition();
  const { show } = useToast();

  const { goals, allLogs, loaded, reloadFresh } = useClimbingData({
    // The year we wanted to stay on has no goals left: let the normal year pick run.
    onGoals: (gs) => {
      if (pendingYearRef.current != null && !gs.some((g) => g.year === pendingYearRef.current)) pendingYearRef.current = null;
    },
    onError: () => {
      pendingYearRef.current = null;
      show("Couldn't load your climbs.");
    },
  });

  function onGoalsChanged(savedYear?: number) {
    if (savedYear != null) { pendingYearRef.current = savedYear; setGoalsYear(savedYear); }
    reloadFresh();
  }

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

  const detailData = useGoalDetail(selectedGoal, yearLogsByYear, today);

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

      <div {...enter(0, 'empty:hidden')}>
        {!loaded ? (
          <Card><Skeleton className="h-6 w-2/3" /></Card>
        ) : (
          <LastSession logs={allLogs} onShare={(d) => { setStoryDate(d); setStoryStyle('story'); }} />
        )}
      </div>

      <div {...enter(1)}>
        {loaded ? <StrongerSection logs={shownYearLogs} year={goalsYear} onOpen={openDetail} /> : <Card><Skeleton className="h-28 w-full" /></Card>}
      </div>

      {/* ── Sections 2 and 3, side by side from 1024 px ────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <div {...enter(2, 'min-w-0 [&>*]:h-full')}>
          <GoalsSection
            goals={goalsForSelectedYear}
            summary={goalsSummary}
            onAdd={() => setGoalSheetOpen(true)}
            onOpen={(g) => setSelectedGoal({ id: g.id, year: g.year, type: g.type, grade: g.grade, target: g.target })}
          />
        </div>

        <div {...enter(3, 'min-w-0 [&>*]:h-full')}>
          {loaded ? (
            <EnoughSection allLogs={allLogs} yearLogs={shownYearLogs} year={goalsYear} asOf={asOf} onOpen={openDetail} />
          ) : (
            <Card><Skeleton className="h-28 w-full" /></Card>
          )}
        </div>
      </div>

      {/* ── Links to the bigger picture ────────────────────── */}
      <div {...enter(4, 'flex flex-wrap gap-2')}>
        <button type="button" className="press flex min-h-11 items-center rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={() => openDetail('compare')}>This year vs last ›</button>
        <button type="button" className="press flex min-h-11 items-center rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={() => openDetail('gyms')}>Gyms ›</button>
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
        initialDate={storyDate ?? latestSessionDate(shownYearLogs) ?? (goalsYear === thisYear ? today : `${goalsYear}-12-31`)}
        moreStyles={[
          { label: 'Year (old)', run: () => downloadYearOverlay(shownYearLogs, goalsYear, today) },
          ...(goalsForSelectedYear.length ? [{ label: 'Goals (old)', run: () => downloadGoalsOverlay(goalsForSelectedYear, goalsYear) }] : []),
        ]}
        initialStyle={storyStyle ?? 'year'}
        knownLogs={yearLogsByYear}
      />

      {selectedGoal && detailData.pace && (
        <GoalOverlay
          goal={selectedGoal}
          pace={detailData.pace}
          progressSeries={detailData.progressSeries}
          weeklySeries={detailData.weekly.series}
          weeklyAvg={detailData.weekly.avg}
          bestWeek={detailData.weekly.bestWeek}
          flashPie={detailData.flashPie}
          attemptsDist={detailData.attemptsDist}
          goalItems={detailData.goalLogs}
          byWeekDates={detailData.weekly.byWeekDates}
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
