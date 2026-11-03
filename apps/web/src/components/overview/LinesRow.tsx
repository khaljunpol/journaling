import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchGame } from '@/components/game/useGame';
import LevelChip from '@/components/shell/LevelChip';
import Skeleton from '@/components/ui/Skeleton';
import { parseLocalDate } from '@journaling/core/date';
import type { OverviewView } from './derive';

const ROW = 'card press flex min-h-14 min-w-0 items-center gap-2 px-4 py-3 text-[15px] sm:px-5';

export function LineSkeleton() {
  return (
    <div className="card flex min-h-14 items-center px-4 py-3 sm:px-5">
      <Skeleton className="h-5 w-2/3" />
    </div>
  );
}

/** "Climbing · 2 sessions this week · last on Wed ›". The caller hides it when there are no logs. */
export function ClimbLine({ climb }: { climb: NonNullable<OverviewView['climb']> }) {
  const { sessions, last, daysSince } = climb;
  const lastText = daysSince === 0 ? 'last today' : last ? `last on ${parseLocalDate(last).toLocaleDateString(undefined, { weekday: 'short' })}` : null;
  return (
    <Link href="/climbing" className={ROW} style={{ color: 'var(--text-1)' }}>
      <span className="min-w-0 flex-1">
        Climbing ·{' '}
        {sessions > 0 ? (
          <><span className="num">{sessions}</span> {sessions === 1 ? 'session' : 'sessions'} this week{lastText ? ` · ${lastText}` : ''}</>
        ) : (
          <>last session <span className="num">{daysSince ?? 0}</span> {daysSince === 1 ? 'day' : 'days'} ago</>
        )}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--accent)' }}>›</span>
    </Link>
  );
}

/** LevelChip + "3 side quests active ›". The chip is its own link, so the row holds two links side by side. quests null = dashboard failed: no count, no claim. */
export function ProgressLine({ quests }: { quests: OverviewView['quests'] }) {
  return (
    <div className="card flex min-h-14 min-w-0 items-center gap-2 py-1 pl-4 pr-1 sm:pl-5">
      <LevelChip />
      <Link href="/progress" className="press flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2 text-[15px] hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-1)' }}>
        <span className="min-w-0 flex-1">
          {quests === null ? (
            <>Open Progress</>
          ) : quests.active > 0 ? (
            <><span className="num">{quests.active}</span> {quests.active === 1 ? 'side quest' : 'side quests'} active</>
          ) : (
            <>Start a side quest</>
          )}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--accent)' }}>›</span>
      </Link>
    </div>
  );
}

/** "World · planted this week ›", or the tallest habit plant. Hidden while loading or on error. */
export function WorldLine({ className = '' }: { className?: string }) {
  const [world, setWorld] = useState<{ planted: number; tallest: { name: string; tiles: number } | null; weekMet: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Shares the page's one /api/game request (the level chip uses it too).
    fetchGame().then((g) => { if (!cancelled && g.world) setWorld(g.world); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!world) return null;
  const { tallest, weekMet } = world;
  const tiles = tallest ? Math.round(tallest.tiles * 10) / 10 : 0;
  return (
    <Link href="/world" className={`${ROW} ${className}`} style={{ color: 'var(--text-1)' }}>
      <span className="min-w-0 flex-1">
        World ·{' '}
        {weekMet ? (
          <>planted this week</>
        ) : tallest && tiles >= 1 ? (
          <>{tallest.name} is <span className="num">{tiles}</span> {tiles === 1 ? 'tile' : 'tiles'} tall</>
        ) : (
          <>your valley</>
        )}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--accent)' }}>›</span>
    </Link>
  );
}
