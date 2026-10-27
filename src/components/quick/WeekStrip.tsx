'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseLocalDate } from '@/lib/date';

export type StripDay = { date: string; filled: number; total: number } | { date: string; filled: null; total: null };

type Props = {
  /** Mon..Sun of the current week. Empty while the shell loads. */
  days: StripDay[];
  today: string | null;
  selected: string | null;
  onSelect: (date: string) => void;
  /** Week arrows. Left out, the strip shows no arrows. */
  weekLabel?: string;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
};

const INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Violet while a day is filling, ember only when the day is closed. */
function ring(filled: number | null, total: number | null): string {
  if (filled === null || !total) return 'conic-gradient(var(--surface-3) 0 100%)';
  const pct = Math.round((filled / total) * 100);
  const color = filled >= total ? 'var(--reward)' : 'var(--accent)';
  return `conic-gradient(${color} 0 ${pct}%, var(--surface-3) ${pct}% 100%)`;
}

const ARROW = 'flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--surface-2)] disabled:opacity-40';

export default function WeekStrip({ days, today, selected, onSelect, weekLabel, canNext = false, onPrev, onNext }: Props) {
  // Skeleton: seven quiet circles so the page never looks empty.
  const items: StripDay[] = days.length
    ? days
    : INITIALS.map((_, i) => ({ date: `skeleton-${i}`, filled: null, total: null }));
  return (
    <nav aria-label="Week">
      {onPrev && onNext && (
        <div className="flex items-center justify-between">
          <button type="button" onClick={onPrev} aria-label="Previous week" className={ARROW} style={{ color: 'var(--text-2)' }}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }} aria-live="polite">
            {weekLabel}
          </span>
          <button type="button" onClick={onNext} disabled={!canNext} aria-label="Next week" className={ARROW} style={{ color: 'var(--text-2)' }}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex justify-between">
        {items.map((d, i) => {
          const future = today !== null && !d.date.startsWith('skeleton') && d.date > today;
          const label = d.date.startsWith('skeleton')
            ? ''
            : parseLocalDate(d.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
          const isSel = d.date === selected;
          return (
            <button
              key={d.date}
              type="button"
              disabled={future || d.date.startsWith('skeleton')}
              aria-label={d.filled !== null ? `${label}, ${d.filled} of ${d.total} done` : label}
              aria-current={d.date === today ? 'date' : undefined}
              onClick={() => onSelect(d.date)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full disabled:opacity-40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: ring(d.filled, d.total) }}>
                <span
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] font-medium"
                  style={{
                    background: isSel ? 'var(--surface-2)' : 'var(--surface)',
                    color: d.date === today ? 'var(--accent)' : 'var(--text-1)',
                    boxShadow: isSel ? 'inset 0 0 0 1.5px var(--accent)' : undefined,
                  }}
                >
                  {INITIALS[i]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
