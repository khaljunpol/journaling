'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { useFirstVisit } from '@/components/ui/useFirstVisit';
import { parseLocalDate } from '@journaling/core/date';
import HabitsSection from './HabitsSection';
import KeepingCard from './KeepingCard';
import { ClimbLine, LineSkeleton, ProgressLine, WorldLine } from './LinesRow';
import MoodSection from './MoodSection';
import OverviewSheets, { type OverviewDetail } from './OverviewSheets';
import RecapCard, { RecapSkeleton } from './RecapCard';
import RememberStrip from './RememberStrip';
import TimeSection from './TimeSection';
import { useOverviewData } from './useOverviewData';

/** Grid cell with the entrance (first mount per tab only). Its child fills the cell, so a row lines up. */
function Enter({ i, animate, className = '', children }: { i: number; animate: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 [&>*]:h-full ${animate ? 'ov-in' : ''} ${className}`} style={{ '--i': i } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Overview: 3 questions (mood + sleep, habits, time), then Remember, last week's recap, Keeping up, then the Climbing and Progress lines.
 * Phone: one column. Tablet: Q1 full width, Q2 | Q3. Desktop: the 3 questions side by side.
 */
export default function Overview() {
  const animate = useFirstVisit('overview:entered');
  const { today, view, hasDash, dashFailed, failed, retry } = useOverviewData();
  const [detail, setDetail] = useState<OverviewDetail | null>(null);

  if (failed) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4">
        <PageHeader title="Overview" />
        <EmptyState title="Could not load Overview" hint="Check your connection and try again." action={<Button onClick={retry}>Try again</Button>} />
      </div>
    );
  }

  const dateLabel = parseLocalDate(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  // Skeleton while the dashboard loads; no row when there are no logs or the read failed with no cache.
  const showClimb = view.climb !== null || (!hasDash && !dashFailed);
  const showRecap = view.recap !== null || (!hasDash && !dashFailed);

  return (
    <>
      <div className="mx-auto w-full max-w-[1280px] space-y-3 pb-4 lg:space-y-4">
        <PageHeader title="Overview" context={dateLabel} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <Enter i={0} animate={animate} className="sm:col-span-2 lg:col-span-1">
            <MoodSection mood={view.mood} today={today} onDetails={() => setDetail('mood')} />
          </Enter>
          <Enter i={1} animate={animate}>
            <HabitsSection habits={view.habits} today={today} onDetails={() => setDetail('habits')} />
          </Enter>
          <Enter i={2} animate={animate}>
            <TimeSection time={view.time} failed={dashFailed} onDetails={() => setDetail('time')} />
          </Enter>
          <Enter i={3} animate={animate} className="sm:col-span-2 lg:col-span-3">
            <RememberStrip remember={view.remember} />
          </Enter>
          {showRecap ? (
            <Enter i={4} animate={animate} className="sm:col-span-2 lg:col-span-3">
              {view.recap ? <RecapCard recap={view.recap} /> : <RecapSkeleton />}
            </Enter>
          ) : null}
          {view.keeping ? (
            <Enter i={5} animate={animate} className="sm:col-span-2 lg:col-span-3">
              <KeepingCard keeping={view.keeping} onDetails={() => setDetail('keeping')} />
            </Enter>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          {/* No climbing logs: no row and no empty cell. */}
          {showClimb ? (
            <Enter i={6} animate={animate}>
              {view.climb ? <ClimbLine climb={view.climb} /> : <LineSkeleton />}
            </Enter>
          ) : null}
          {/* Climbing hidden: Progress spans the row (from cache this is known on first paint, so no jump). */}
          <Enter i={7} animate={animate} className={showClimb ? '' : 'lg:col-span-2'}>
            {view.quests || dashFailed ? <ProgressLine quests={view.quests} /> : <LineSkeleton />}
          </Enter>
          <WorldLine className="lg:col-span-2" />
        </div>
      </div>

      {/* Sheets sit outside the .ov-in cells: a transformed parent would trap their position: fixed. */}
      <OverviewSheets view={view} open={detail} onClose={() => setDetail(null)} />
    </>
  );
}
