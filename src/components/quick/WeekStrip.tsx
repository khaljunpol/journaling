'use client';

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

function ring(filled: number | null, total: number | null): string {
  if (filled === null || !total) return 'conic-gradient(var(--border) 0 100%)';
  const pct = Math.round((filled / total) * 100);
  return `conic-gradient(var(--ok) 0 ${pct}%, var(--border) ${pct}% 100%)`;
}

export default function WeekStrip({ days, today, selected, onSelect, weekLabel, canNext = false, onPrev, onNext }: Props) {
  // Skeleton: seven quiet circles so the page never looks empty.
  const items: StripDay[] = days.length
    ? days
    : INITIALS.map((_, i) => ({ date: `skeleton-${i}`, filled: null, total: null }));
  return (
    <nav aria-label="Week">
      {onPrev && onNext && (
        <div className="flex items-center justify-between">
          <button type="button" onClick={onPrev} aria-label="Previous week" className="btn-outline flex min-h-11 min-w-11 items-center justify-center rounded-full">
            ‹
          </button>
          <span className="text-sm muted" aria-live="polite">
            {weekLabel}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Next week"
            className="btn-outline flex min-h-11 min-w-11 items-center justify-center rounded-full disabled:opacity-40"
          >
            ›
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
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: ring(d.filled, d.total) }}
            >
              <span
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-medium"
                style={{
                  background: isSel ? 'var(--surface-alt)' : 'var(--bg)',
                  color: d.date === today ? 'var(--accent)' : 'var(--text)',
                  boxShadow: isSel ? 'inset 0 0 0 1.5px var(--muted-foreground)' : undefined,
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
