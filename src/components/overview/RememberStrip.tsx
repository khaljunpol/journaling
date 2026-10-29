import Link from 'next/link';
import type { ReactNode } from 'react';
import { QUESTION_CLASS } from '@/components/climbing/overview/types';
import Skeleton from '@/components/ui/Skeleton';
import { parseLocalDate } from '@/lib/date';
import type { OverviewView } from './derive';
import { NextLink } from './Section';

const short = (iso: string, weekday = false) =>
  parseLocalDate(iso).toLocaleDateString(undefined, weekday ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });

const HALF = 'press block min-h-11 min-w-0 rounded-[10px] p-3 hover:bg-[var(--surface-2)]';
/** Every half body is 2 lines tall (44px), loaded, empty or skeleton, so nothing moves when data lands. */
const BODY = 'mt-1 line-clamp-2 min-h-[44px] leading-[22px]';

function Label({ children }: { children: ReactNode }) {
  return <p className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>{children}</p>;
}

/** Last highlight | the same day a month ago. Each half opens that day in Today. */
export default function RememberStrip({ remember }: { remember: OverviewView['remember'] }) {
  const { ready, highlight, monthAgo } = remember;
  const shell = 'card grid grid-cols-1 gap-1 p-2 sm:grid-cols-2 sm:gap-2';
  if (!ready) {
    return (
      <section className={shell} aria-label="Remember">
        {[0, 1].map((i) => (
          <div key={i} className="p-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-[44px] w-3/4" />
          </div>
        ))}
      </section>
    );
  }
  const agoEmpty = monthAgo.loaded && monthAgo.mood === null && monthAgo.text === null;
  if (!highlight && agoEmpty) {
    return (
      <section className="card flex flex-wrap items-center gap-x-2 px-4 py-2 sm:px-5" aria-label="Remember">
        <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No highlights lately.</p>
        <NextLink href="/quick">Add one today ›</NextLink>
      </section>
    );
  }
  return (
    <section className={shell} aria-label="Remember">
      {highlight ? (
        <Link href={`/quick?date=${highlight.date}`} className={HALF}>
          <Label>Last highlight · {short(highlight.date, true)}</Label>
          <p className={`${BODY} text-[15px]`} style={{ color: 'var(--text-1)' }}>{highlight.text}</p>
        </Link>
      ) : (
        <div className="min-w-0 p-3">
          <Label>Last highlight</Label>
          <p className={`${BODY} text-[14px]`} style={{ color: 'var(--text-2)' }}>No highlight in the last 30 days.</p>
        </div>
      )}
      <Link href={`/quick?date=${monthAgo.date}`} className={`${HALF} border-t sm:border-l sm:border-t-0`} style={{ borderColor: 'var(--border)' }}>
        <Label>A month ago · {short(monthAgo.date)}</Label>
        {monthAgo.failed ? (
          <p className={`${BODY} text-[14px]`} style={{ color: 'var(--text-2)' }}>Couldn&rsquo;t load {short(monthAgo.date)}.</p>
        ) : !monthAgo.loaded ? (
          <Skeleton className="mt-1 h-[44px] w-3/4" />
        ) : agoEmpty ? (
          <p className={`${BODY} text-[14px]`} style={{ color: 'var(--text-2)' }}>Nothing logged on {short(monthAgo.date)}.</p>
        ) : (
          <p className={`${BODY} text-[15px]`} style={{ color: 'var(--text-1)' }}>
            {monthAgo.mood !== null ? <>Mood <span className="num">{monthAgo.mood}</span></> : null}
            {monthAgo.mood !== null && monthAgo.text ? ' · ' : null}
            {monthAgo.text ? <>‘{monthAgo.text}’</> : null}
          </p>
        )}
      </Link>
    </section>
  );
}
