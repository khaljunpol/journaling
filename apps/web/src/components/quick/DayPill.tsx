'use client';

import { CalendarDays } from 'lucide-react';
import { parseLocalDate } from '@/lib/date';

/** Which day an editor writes to. Today stays quiet; any other day gets the accent so it can't be missed. */
export default function DayPill({ date, today, yesterday }: { date: string; today: string | null; yesterday: string | null }) {
  const isToday = date === today;
  const full = parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const label = isToday ? `Today · ${full}` : date === yesterday ? `Yesterday · ${full}` : full;
  return (
    <span
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium"
      style={{
        background: isToday ? 'var(--surface-2)' : 'var(--accent-soft)',
        color: isToday ? 'var(--text-2)' : 'var(--accent)',
      }}
    >
      <CalendarDays size={15} aria-hidden="true" />
      {label}
    </span>
  );
}
