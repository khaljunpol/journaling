import Link from 'next/link';
import type { CSSProperties } from 'react';
import { parseLocalDate } from '@journaling/core/date';
import type { DayState } from '@journaling/core/dayState';
import type { KeepingUp } from '@journaling/core/keepingUp';
import { PlainAnswer, Section, SubLine } from './Section';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STATE_LABEL: Record<DayState, string> = { onTime: 'on time', late: 'late', missed: 'missed', waiting: 'today' };
/** Shape carries the meaning too: full, half, hollow. Late and missed match the week rings. */
const DOT: Record<DayState, CSSProperties> = {
  onTime: { background: 'var(--accent)' },
  late: { background: 'conic-gradient(var(--sync) 0 50%, transparent 0)', boxShadow: 'inset 0 0 0 1.5px var(--sync)' },
  missed: { boxShadow: 'inset 0 0 0 2px var(--warn)' },
  waiting: { boxShadow: 'inset 0 0 0 1.5px var(--text-3)' },
};
const EMPTY: CSSProperties = { background: 'var(--surface-3)' };
const ROWS = 'grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] items-center';

const Dot = ({ style }: { style: CSSProperties }) => <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={style} />;
const weekLabel = (iso: string) => parseLocalDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dayLabel = (iso: string) => parseLocalDate(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** Four weeks of logging. A dot opens that day, so a missed day is one tap from being filled in. */
export default function KeepingCard({ keeping, onDetails }: { keeping: KeepingUp; onDetails: () => void }) {
  const { lines, weeks } = keeping;
  return (
    <Section question="Keeping up" onDetails={onDetails}>
      <PlainAnswer>{lines[0]}</PlainAnswer>
      {lines[1] ? <SubLine>{lines[1]}</SubLine> : null}

      <div className="mt-3 max-w-[520px]">
        <div className={ROWS} aria-hidden="true">
          <span />
          {WEEKDAYS.map((d, i) => <span key={i} className="text-center text-[12px]" style={{ color: 'var(--text-3)' }}>{d}</span>)}
        </div>
        {weeks.map((w) => (
          <div key={w.monday} className={ROWS}>
            <span className="num text-[12px]" style={{ color: 'var(--text-3)' }}>{weekLabel(w.monday)}</span>
            {w.days.map((d) => (d.state ? (
              <Link
                key={d.date}
                href={`/quick?date=${d.date}`}
                aria-label={`${dayLabel(d.date)}, ${STATE_LABEL[d.state]}`}
                className="press flex h-9 items-center justify-center rounded-[10px] hover:bg-[var(--surface-2)]"
              >
                <Dot style={DOT[d.state]} />
              </Link>
            ) : (
              <span key={d.date} className="flex h-9 items-center justify-center"><Dot style={EMPTY} /></span>
            )))}
          </div>
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
        {(['onTime', 'late', 'missed'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5"><Dot style={DOT[s]} />{STATE_LABEL[s]}</li>
        ))}
      </ul>
    </Section>
  );
}
