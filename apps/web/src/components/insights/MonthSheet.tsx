'use client';

import Link from 'next/link';
import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';

export type Cell = { color: string; label: string };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Dates of a month with their Monday-first column, oldest first. */
export function monthDates(year: number, month: number): Array<{ date: string; col: number; row: number }> {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const n = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const k = lead + i;
    return { date: `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, col: k % 7, row: Math.floor(k / 7) };
  });
}

/** The day line under a calendar: the date, what it held, and a way into that day. */
export function DayStrip({ date, cell, today }: { date: string | null; cell: Cell | null; today: string }) {
  return (
    <div className="mt-3 flex min-h-14 items-center gap-3 rounded-[10px] px-3 py-1" style={{ background: 'var(--surface-2)' }} aria-live="polite">
      {date ? (
        <>
          <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ background: cell?.color ?? 'var(--surface-3)' }} />
          <div className="min-w-0 flex-1 text-[14px]">
            <div style={{ color: 'var(--text-1)' }}>
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className="num truncate text-[13px]" style={{ color: 'var(--text-2)' }}>{cell ? cell.label.slice(12) : 'Nothing logged'}</div>
          </div>
          {date <= today ? (
            <Link href={`/quick?date=${date}`} className="press flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium" style={{ color: 'var(--accent)' }}>
              Open day
            </Link>
          ) : null}
        </>
      ) : (
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Tap a day to see it.</p>
      )}
    </div>
  );
}

/** One month at finger size (44px cells), for phones. */
export default function MonthSheet({ year, month, values, today, onClose }: { year: number; month: number | null; values: Record<string, Cell>; today: string; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const open = month !== null;
  const dates = open ? monthDates(year, month) : [];
  return (
    <Sheet open={open} onClose={() => { setPicked(null); onClose(); }} title={open ? `${MONTH_NAMES[month]} ${year}` : ''} initialFocus="panel">
      <div className="grid grid-cols-7 gap-1 pt-2" role="grid" aria-label={open ? `${MONTH_NAMES[month]} ${year}` : undefined}>
        {WEEK.map((d, i) => (
          <span key={i} aria-hidden="true" className="text-center text-[12px]" style={{ color: 'var(--text-3)' }}>{d}</span>
        ))}
        {dates.map((d) => {
          const v = values[d.date];
          const on = picked === d.date;
          const future = d.date > today;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setPicked(d.date)}
              aria-pressed={on}
              aria-label={v ? v.label : `${d.date}: nothing logged`}
              className="num press flex h-11 flex-col items-center justify-center gap-0.5 rounded-[8px] text-[11px] leading-none"
              style={{
                gridColumnStart: d.row === 0 ? d.col + 1 : undefined,
                opacity: future ? 0.35 : 1,
                color: d.date === today ? 'var(--text-1)' : 'var(--text-3)',
                outline: on ? '2px solid var(--text-1)' : undefined,
                outlineOffset: -1,
              }}
            >
              <span aria-hidden="true">{Number(d.date.slice(8))}</span>
              <span aria-hidden="true" className="block h-[22px] w-[30px] rounded-[5px]" style={{ background: v ? v.color : 'var(--surface-3)' }} />
            </button>
          );
        })}
      </div>
      <DayStrip date={picked} cell={picked ? values[picked] ?? null : null} today={today} />
    </Sheet>
  );
}
