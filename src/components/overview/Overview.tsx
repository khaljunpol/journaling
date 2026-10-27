'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import LevelChip from '@/components/shell/LevelChip';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import { parseLocalDate } from '@/lib/date';
import BarStrip from './BarStrip';
import Donut from './Donut';
import FeedItem from './FeedItem';
import Heatmap from './Heatmap';
import KpiCard from './KpiCard';
import Ring from './Ring';
import Sparkline from './Sparkline';
import TrendChip from './TrendChip';
import TrendTable from './TrendTable';
import { useOverviewData } from './useOverviewData';
import WorldTile from './WorldTile';

const SEEN_KEY = 'overview:entered';

/** True only the first time Overview mounts in this browser tab, so going back to it by link does not replay the entrance. */
function useFirstVisit(): boolean {
  const [first] = useState(() => {
    try {
      return window.sessionStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* no storage: no entrance next time either */ }
  }, []);
  return first;
}

function Tile({ i, animate, className = '', children }: { i: number; animate: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${animate ? 'ov-in' : ''} ${className}`} style={{ '--i': i } as CSSProperties}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>{children}</p>;
}

function LinkAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-[10px] px-2 text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
      {children}
    </Link>
  );
}

export default function Overview() {
  const animate = useFirstVisit();
  const { today, view, yearMoods, year, hasDash, hasQuick, failed, retry } = useOverviewData();

  if (failed) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4">
        <PageHeader title="Overview" />
        <EmptyState title="Could not load Overview" hint="Check your connection and try again." action={<Button onClick={retry}>Try again</Button>} />
      </div>
    );
  }

  const dateLabel = parseLocalDate(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const { ring, mood, habit, climb, bars, feed, split, habits, notes, quests } = view;
  const closed = ring !== null && ring.total > 0 && ring.filled >= ring.total;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 pb-4">
      <Tile i={0} animate={animate}>
        <PageHeader title="Overview" context={dateLabel} />
      </Tile>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {/* 1. KPIs */}
        <div className="col-span-full grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Tile i={1} animate={animate}>
            <KpiCard
              label="Today"
              href="/quick"
              loading={!hasQuick}
              value={ring ? `${ring.filled}/${ring.total}` : '-'}
              visual={ring ? <div className="flex justify-end"><Ring filled={ring.filled} total={ring.total} /></div> : undefined}
              sub={closed ? 'Day complete' : 'items logged'}
            />
          </Tile>
          <Tile i={2} animate={animate}>
            <KpiCard
              label="Mood, 7 days"
              href="/trends?tab=mood"
              loading={!hasQuick && !hasDash}
              value={mood.avg ?? '-'}
              unit={mood.avg !== null ? '/10' : undefined}
              visual={<Sparkline values={mood.series} min={0} max={10} />}
              chip={mood.trendText ? <TrendChip text={mood.trendText} delta={mood.trendDelta} /> : undefined}
              sub={mood.avg === null ? 'no moods yet' : undefined}
            />
          </Tile>
          <Tile i={3} animate={animate}>
            <KpiCard
              label="Habit score"
              href="/trends?tab=habits"
              loading={!hasQuick && !hasDash}
              value={habit?.score ?? '-'}
              unit={habit?.score != null ? '/100' : undefined}
              visual={<Sparkline values={habit?.series ?? []} min={0} max={100} />}
              chip={habit?.trendText ? <TrendChip text={habit.trendText} delta={habit.trendDelta} /> : undefined}
              sub={habit?.score == null ? 'builds as you tick' : undefined}
            />
          </Tile>
          <Tile i={4} animate={animate}>
            <KpiCard
              label="Climbing"
              href="/climbing"
              loading={!hasDash}
              value={climb?.month ?? '-'}
              sub="sessions this month"
              chip={climb ? <TrendChip text={climb.trendText} delta={climb.trendDelta} /> : undefined}
            />
          </Tile>
        </div>

        {/* 2. Last 14 days | Today so far */}
        <Tile i={5} animate={animate} className="sm:col-span-1 lg:col-span-2">
          <Card className="h-full">
            <CardHeader title="Last 14 days" meta={<span className="text-[13px]" style={{ color: 'var(--text-2)' }}>tap a day to open it</span>} />
            {bars ? <BarStrip bars={bars} today={today} /> : <Skeleton className="h-24 w-full" />}
          </Card>
        </Tile>
        <Tile i={5} animate={animate} className="lg:col-start-3 lg:row-span-2 lg:row-start-2">
          <Card className="h-full">
            <CardHeader title="Today so far" />
            {feed === null ? (
              <Skeleton className="h-32 w-full" />
            ) : feed.length === 0 ? (
              <div className="space-y-2">
                <Empty>Nothing logged yet today.</Empty>
                <LinkAction href="/quick">Open Today</LinkAction>
              </div>
            ) : (
              <ul>
                {feed.map((e, idx) => (
                  <FeedItem key={e.kind} entry={e} className={idx >= 5 ? 'max-sm:hidden' : ''} />
                ))}
              </ul>
            )}
          </Card>
        </Tile>

        {/* 3. Time split | Notes */}
        <Tile i={5} animate={animate}>
          <Card className="h-full">
            <CardHeader title="Time, last 7 days" actions={<LinkAction href="/trends?tab=time">Trends</LinkAction>} />
            {split === null ? (
              <Skeleton className="h-28 w-full" />
            ) : split.total === 0 ? (
              <Empty>No hours logged this week yet.</Empty>
            ) : (
              <Donut slices={split.slices} total={split.total} />
            )}
          </Card>
        </Tile>
        <Tile i={5} animate={animate}>
          <Card className="h-full">
            <CardHeader title="Notes" />
            {notes === null ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-1)' }}>{notes.summary}</p>
                {notes.signals.length > 0 ? (
                  <ul className="space-y-2">
                    {notes.signals.map((s) => (
                      <li key={s.message} className="flex gap-2 text-[14px]" style={{ color: 'var(--text-2)' }}>
                        <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: s.type === 'positive' ? 'var(--ok)' : 'var(--text-3)' }} />
                        <span>{s.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>All on track.</p>
                )}
                {notes.insight && <p className="rounded-[10px] px-3 py-2 text-[13px]" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{notes.insight}</p>}
              </div>
            )}
          </Card>
        </Tile>

        {/* 4. Habits table (not on phone) | Progress tile */}
        <Tile i={5} animate={animate} className="hidden sm:col-span-2 sm:block">
          <Card className="h-full">
            <CardHeader title="Habits, last 14 days" actions={<LinkAction href="/trends?tab=habits">Trends</LinkAction>} />
            {habits === null ? (
              <Skeleton className="h-32 w-full" />
            ) : habits.length === 0 ? (
              <Empty>No habits yet. Add some in Settings.</Empty>
            ) : (
              <TrendTable rows={habits} />
            )}
          </Card>
        </Tile>
        <Tile i={5} animate={animate} className="sm:max-lg:order-1">
          <Card className="h-full">
            <CardHeader title="Progress" meta={<LevelChip />} actions={<LinkAction href="/progress">Open</LinkAction>} />
            {quests === null ? (
              <Skeleton className="h-20 w-full" />
            ) : quests.length === 0 ? (
              <Empty>No active side quests.</Empty>
            ) : (
              <ul>
                {quests.map((q) => {
                  const total = q.milestones?.length ?? 0;
                  const done = q.milestones?.filter((m) => m.completedAt).length ?? 0;
                  return (
                    <li key={q.id} className="flex min-h-11 items-center gap-3 border-t py-1.5 first:border-t-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--text-1)' }}>{q.title}</span>
                      {total > 0 && <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{done}/{total}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Tile>

        {/* 5. Year heatmap (not on phone) | World tile */}
        <Tile i={5} animate={animate} className="hidden sm:col-span-2 sm:block">
          <Card className="h-full">
            <CardHeader title={`Mood in ${year}`} actions={<LinkAction href="/trends?tab=mood">Trends</LinkAction>} />
            <Heatmap year={year} moods={yearMoods} today={today} />
          </Card>
        </Tile>
        <Tile i={5} animate={animate} className="sm:max-lg:order-1">
          <WorldTile />
        </Tile>

        {/* Phone: the wide tiles are links */}
        <Tile i={5} animate={animate} className="sm:hidden">
          <Card>
            <CardHeader title="More detail" />
            <div className="flex flex-col">
              <LinkAction href="/trends?tab=habits">Habits table on Trends</LinkAction>
              <LinkAction href="/trends?tab=mood">Year heatmap on Trends</LinkAction>
            </div>
          </Card>
        </Tile>
      </div>
    </div>
  );
}
