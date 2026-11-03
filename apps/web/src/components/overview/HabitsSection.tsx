import Link from 'next/link';
import Answer from '@/components/climbing/overview/Answer';
import { parseLocalDate } from '@journaling/core/date';
import type { OverviewView } from './derive';
import { NextLink, PlainAnswer, Section, SectionSkeleton, signed } from './Section';
import TrendChip from './TrendChip';

const Q = 'Am I keeping my habits?';

export default function HabitsSection({ habits, today, onDetails }: { habits: OverviewView['habits']; today: string; onDetails: () => void }) {
  if (!habits) return <SectionSkeleton question={Q} />;
  if (habits.count === 0 || habits.rate === null) {
    return (
      <Section question={Q}>
        <PlainAnswer>No habits yet</PlainAnswer>
        <NextLink href="/settings#activities">Add habits ›</NextLink>
      </Section>
    );
  }
  const { rate, delta, streak, bars } = habits;
  // Never "0%": nothing ticked in 2 weeks gets a kind line and a way back.
  if (bars.every((b) => b.done === 0)) {
    return (
      <Section question={Q} onDetails={onDetails}>
        <PlainAnswer>No habits ticked in the last 2 weeks</PlainAnswer>
        <NextLink href="/quick">Open Today ›</NextLink>
      </Section>
    );
  }
  const streakPart = streak >= 2 ? [<><span className="num">{streak}</span>-day streak</>] : streak === 1 ? [<><span className="num">1</span> good day</>] : [];
  return (
    <Section question={Q} onDetails={onDetails}>
      <Answer parts={[<><span className="num">{rate}%</span> of habits done</>, ...streakPart]} />
      {delta !== null ? (
        <div className="mt-1.5">
          <TrendChip text={delta === 0 ? 'same as the 2 weeks before' : `${signed(delta)} vs the 2 weeks before`} delta={delta} />
        </div>
      ) : null}
      <div className="relative mt-auto pt-4">
        {/* 50% guide: a good day reaches it. pt-4 + half of h-24 = 64px from the top. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-16 z-[1] border-t border-dashed" style={{ borderColor: 'var(--border-strong)' }} />
        <ul className="flex h-24" aria-label="Habits done each day, last 14 days. Tap a day to open it in Today.">
          {bars.map((b) => {
            const long = parseLocalDate(b.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
            return (
              <li key={b.date} className="h-full min-w-0 flex-1">
                <Link
                  href={`/quick?date=${b.date}`}
                  aria-label={`${long}: ${b.done} of ${b.active} habits done. Open in Today`}
                  className="press flex h-full min-h-11 items-end px-[2px]"
                >
                  <span
                    className="relative block h-full w-full overflow-hidden rounded-[4px]"
                    style={b.date === today ? { outline: '1px solid var(--accent)', outlineOffset: 1 } : undefined}
                  >
                    {b.done === 0 ? (
                      <span className="absolute inset-x-0 bottom-0 block h-[2px] rounded-full" style={{ background: 'var(--border-strong)' }} />
                    ) : (
                      <span className="bar-y absolute inset-0 block" style={{ transform: `scaleY(${Math.min(1, b.share)})`, background: 'var(--accent)' }} />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
