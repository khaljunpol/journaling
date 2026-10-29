import { ANSWER_CLASS } from '@/components/climbing/overview/types';
import type { OverviewView } from './derive';
import { NextLink, PlainAnswer, Section, SectionSkeleton, signed } from './Section';

const Q = 'Where is my time going?';
const OTHER = '#7A84A0';

type Row = { id: string; name: string; color: string; hours: number; prev: number };

export default function TimeSection({ time, failed, onDetails }: { time: OverviewView['time']; failed: boolean; onDetails: () => void }) {
  if (!time) {
    if (!failed) return <SectionSkeleton question={Q} rows />;
    return (
      <Section question={Q}>
        <PlainAnswer>Couldn&rsquo;t load your hours right now.</PlainAnswer>
      </Section>
    );
  }
  if (!time.top || time.total === 0) {
    // Sleep is left out here (Q1 shows it); the Time sheet still lists it.
    return (
      <Section question={Q} onDetails={time.sleepOnly ? onDetails : undefined}>
        <PlainAnswer>{time.sleepOnly ? 'Only sleep logged this week.' : 'No hours logged this week yet.'}</PlainAnswer>
        <NextLink href="/quick">Open Today ›</NextLink>
      </Section>
    );
  }
  const { top } = time;
  const rows: Row[] = time.other ? [...time.rows, { id: 'other', name: 'Other', color: OTHER, ...time.other }] : time.rows;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.hours, r.prev)));
  return (
    <Section question={Q} onDetails={onDetails}>
      {/* Not <Answer>: a long category name must be able to wrap on a 360px phone. */}
      <p className={`${ANSWER_CLASS} break-words`} style={{ color: 'var(--text-1)' }}>
        Most time: <strong className="font-semibold">{top.name} <span className="num whitespace-nowrap">{top.hours}h</span></strong>
        {' · '}
        <span className="whitespace-nowrap">
          {top.delta === 0 ? 'same as last week' : <><span className="num">{signed(top.delta, 'h')}</span> vs last week</>}
        </span>
      </p>
      <ul className="mt-auto box-content h-[140px] space-y-1 pt-4" aria-label="Hours per category this week. The tick marks last week, same days.">
        {rows.map((r) => (
          <li key={r.id} className="flex h-5 items-center gap-2 text-[13px]">
            <span className="sr-only">{`${r.name}: ${r.hours}h this week, ${r.prev}h last week`}</span>
            <span className="w-24 shrink-0 truncate" style={{ color: 'var(--text-2)' }} aria-hidden="true">{r.name}</span>
            <span className="relative h-2.5 min-w-0 flex-1 rounded-full" style={{ background: 'var(--surface-3)' }} aria-hidden="true">
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <span className="bar-x absolute inset-0 block" style={{ transform: `scaleX(${r.hours / max})`, background: r.color }} />
              </span>
              {r.prev > 0 ? (
                <span className="absolute -top-[3px] block h-4 w-[2px] rounded-full" style={{ left: `calc(${(r.prev / max) * 100}% - 1px)`, background: 'var(--text-3)' }} />
              ) : null}
            </span>
            <span className="num w-9 shrink-0 text-right" style={{ color: 'var(--text-1)' }} aria-hidden="true">{r.hours}h</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
