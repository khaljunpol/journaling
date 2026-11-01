'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseLocalDate } from '@journaling/core/date';
import type { DayState } from '@journaling/core/dayState';

export type StripDay = { date: string; filled: number; total: number; state?: DayState | null } | { date: string; filled: null; total: null; state?: undefined };

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

/** Violet while a day is filling, ember only when the day is closed. Blue was logged late, red is still missing. */
function ring(filled: number | null, total: number | null, state?: DayState | null): string {
  if (state === 'missed') return 'conic-gradient(var(--warn) 0 100%)';
  if (filled === null || !total) return 'conic-gradient(var(--surface-3) 0 100%)';
  const pct = Math.round((filled / total) * 100);
  const color = state === 'late' ? 'var(--sync)' : filled >= total ? 'var(--reward)' : 'var(--accent)';
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
              aria-label={d.filled !== null ? `${label}, ${d.filled} of ${d.total} done${d.state === 'late' ? ', logged late' : d.state === 'missed' ? ', missed' : ''}` : label}
              aria-current={d.date === today ? 'date' : undefined}
              aria-pressed={isSel}
              onClick={() => onSelect(d.date)}
              className="press flex min-h-11 min-w-11 items-center justify-center rounded-full disabled:opacity-40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: ring(d.filled, d.total, d.state) }}>
                {/* Selected day: a solid fill, so it reads at a glance next to the progress rings. */}
                <span
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] ${isSel ? 'font-semibold' : 'font-medium'}`}
                  style={{
                    background: isSel ? 'var(--accent-fill)' : 'var(--surface)',
                    color: isSel ? 'var(--on-accent-fill)' : d.date === today ? 'var(--accent)' : 'var(--text-1)',
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
