import Answer from '@/components/climbing/overview/Answer';
import { parseLocalDate } from '@journaling/core/date';
import { hm } from '@journaling/core/overviewStats';
import type { OverviewView } from './derive';
import { Section, SectionSkeleton, signed } from './Section';
import TrendChip from './TrendChip';

const Q = 'How am I doing?';

export default function MoodSection({ mood, today, onDetails }: { mood: OverviewView['mood']; today: string; onDetails: () => void }) {
  if (!mood) return <SectionSkeleton question={Q} />;
  const { avg, prevAvg, delta, sleepAvg, bars } = mood;
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
