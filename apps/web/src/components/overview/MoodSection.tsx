import type { ReactNode } from 'react';
import Answer from '@/components/climbing/overview/Answer';
import { parseLocalDate } from '@journaling/core/date';
import { hm } from '@journaling/core/overviewStats';
import type { MoodLink, OverviewView } from './derive';
import { Section, SectionSkeleton, SubLine, signed } from './Section';
import TrendChip from './TrendChip';

const Q = 'How am I doing?';

/** The link line under the mood answer, in spec order (sleep, habits, n more days, about the same). */
export function linkCopy(link: MoodLink): ReactNode {
  switch (link.kind) {
    case 'sleep':
      return <>Mood is <span className="num">{link.diff}</span> higher {link.side === 'hi' ? 'after 7h+ sleep' : 'after nights under 7h'}.</>;
    case 'habits':
      return <>Mood is <span className="num">{link.diff}</span> higher on days you do half your habits.</>;
    case 'more':
      return <><span className="num">{link.days}</span> more {link.days === 1 ? 'day' : 'days'} of mood + sleep to see a link.</>;
    case 'same':
      return <>Mood looks about the same however you sleep.</>;
  }
}

export default function MoodSection({ mood, today, onDetails }: { mood: OverviewView['mood']; today: string; onDetails: () => void }) {
  if (!mood) return <SectionSkeleton question={Q} />;
  const { avg, prevAvg, delta, sleepAvg, link, bars } = mood;
  const sleepPart = sleepAvg !== null ? [<>sleep <span className="num">{hm(sleepAvg)}</span> a night</>] : [];
  const parts = avg !== null
    ? [<>Mood <span className="num">{avg}</span> this week</>, ...sleepPart]
    : [<>No mood yet this week</>, ...(prevAvg !== null ? [<>last week <span className="num">{prevAvg}</span></>] : []), ...sleepPart];
  const logged = bars.filter((b) => b.value !== null);
  return (
    <Section question={Q} onDetails={onDetails}>
      <Answer parts={parts} />
      {delta !== null ? (
        <div className="mt-1.5">
          <TrendChip text={delta === 0 ? 'same as last week' : `${signed(delta)} vs last week`} delta={delta} />
        </div>
      ) : null}
      {link ? <SubLine>{linkCopy(link)}</SubLine> : null}
      <div className="mt-auto pt-4">
        <div
          className="flex h-24 items-end gap-1"
          role="img"
          aria-label={`Mood, last 14 days: ${logged.length ? logged.map((b) => `${parseLocalDate(b.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })} ${b.value}`).join(', ') : 'none logged'}.`}
        >
          {bars.map((b) => (
            <div
              key={b.date}
              className="relative h-full min-w-0 flex-1 overflow-hidden rounded-[4px]"
              style={b.date === today ? { outline: '1px solid var(--accent)', outlineOffset: 1 } : undefined}
            >
              {b.value === null ? (
                <span className="absolute inset-x-0 bottom-0 block h-[2px] rounded-full" style={{ background: 'var(--border-strong)' }} />
              ) : (
                <span
                  className="bar-y absolute inset-0 block"
                  style={{ transform: `scaleY(${Math.max(0.04, b.value / 10)})`, background: b.thisWeek ? 'var(--accent)' : 'var(--border-strong)' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
