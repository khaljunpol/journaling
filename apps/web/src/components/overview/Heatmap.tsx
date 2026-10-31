import type { KeyboardEvent } from 'react';
import { moodColor, moodLabel } from '@/lib/mood';
import { addDaysISO, mondayOf } from '@/lib/quickWeek';

const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;
const TOP = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  year: number;
  moods: Record<string, number>;
  today: string;
  /** Makes the cells tappable (Trends). Without it the grid is a plain picture (Overview). */
  onSelect?: (date: string) => void;
  selected?: string | null;
};

/**
 * Year grid, one cell per day, coloured by mood. Own SVG.
 * Read-only by default. With `onSelect`, a cell is a button: tap, or arrow keys to move
 * (left/right = day, up/down = week) and Enter or Space to pick.
 */
export default function Heatmap({ year, moods, today, onSelect, selected = null }: Props) {
  const first = `${year}-01-01`;
  const start = mondayOf(first);
  const cols = 53;
  const cells: Array<{ date: string; col: number; row: number }> = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const date = addDaysISO(start, c * 7 + r);
      if (date.startsWith(`${year}-`)) cells.push({ date, col: c, row: r });
    }
  }
  const logged = cells.filter((c) => moods[c.date] !== undefined).length;
  const monthStarts = new Map<number, number>();
  for (const c of cells) {
    const m = Number(c.date.slice(5, 7)) - 1;
    if (c.date.endsWith('-01') || (m === 0 && c.col === 0)) monthStarts.set(m, c.col);
  }
  const interactive = typeof onSelect === 'function';
  const tabStop = cells.some((c) => c.date === selected) ? selected : cells.some((c) => c.date === today) ? today : cells[0]?.date;

  function onKey(e: KeyboardEvent<SVGRectElement>, date: string) {
    if (!onSelect) return;
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -7 : e.key === 'ArrowDown' ? 7 : 0;
    if (step !== 0) {
      e.preventDefault();
      const next = addDaysISO(date, step);
      if (!next.startsWith(`${year}-`)) return;
      (e.currentTarget.ownerSVGElement?.querySelector(`[data-date="${next}"]`) as SVGRectElement | null)?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(date);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${cols * STEP} ${TOP + 7 * STEP}`}
      className="h-auto w-full"
      role={interactive ? 'group' : 'img'}
      aria-label={
        interactive
          ? `Mood by day in ${year}: ${logged} days logged. Use the arrow keys to move between days.`
          : `Mood by day in ${year}: ${logged} days logged. Open Trends for details.`
      }
    >
      {[...monthStarts.entries()].map(([m, col]) => (
        <text key={m} x={col * STEP} y={9} fontSize="9" fill="var(--text-3)">{MONTHS[m]}</text>
      ))}
      {cells.map((c) => {
        const score = moods[c.date];
        const future = c.date > today;
        const isSel = selected === c.date;
        const label = score !== undefined ? `${c.date}: ${moodLabel(score)} (${score}/10)` : `${c.date}: no mood`;
        return (
          <rect
            key={c.date}
            data-date={c.date}
            x={c.col * STEP}
            y={TOP + c.row * STEP}
            width={CELL}
            height={CELL}
            rx={2}
            fill={score !== undefined ? moodColor(score) : 'var(--surface-3)'}
            opacity={future ? 0.35 : score !== undefined ? 0.95 : 0.8}
            stroke={isSel ? 'var(--text-1)' : 'none'}
            strokeWidth={isSel ? 1.5 : 0}
            {...(interactive
              ? {
                  role: 'button',
                  tabIndex: c.date === tabStop ? 0 : -1,
                  'aria-label': label,
                  'aria-pressed': isSel,
                  className: 'cursor-pointer outline-none focus-visible:stroke-[var(--accent)] focus-visible:[stroke-width:2px]',
                  onClick: () => onSelect?.(c.date),
                  onKeyDown: (e: KeyboardEvent<SVGRectElement>) => onKey(e, c.date),
                }
              : {})}
          >
            <title>{label}</title>
          </rect>
        );
      })}
    </svg>
  );
}
