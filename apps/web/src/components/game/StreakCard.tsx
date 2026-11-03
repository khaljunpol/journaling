'use client';

import { Flame, Share2, Snowflake } from 'lucide-react';
import { useState } from 'react';
import { Section } from '@/components/overview/Section';
import Sheet from '@/components/ui/Sheet';
import { habitIcon } from '@journaling/core/habitIcons';
import type { Streak } from '@journaling/core/streaks';

const unitShort = (s: Streak, n: number) => (s.unit === 'weeks' ? `${n} ${n === 1 ? 'wk' : 'wks'}` : `${n} ${n === 1 ? 'day' : 'days'}`);

function Row({ s, onShare, showBest = false }: { s: Streak; onShare?: (s: Streak) => void; showBest?: boolean }) {
  return (
    <li className="flex min-h-11 items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-[15px]" style={{ color: 'var(--text-1)' }}>{s.name}</span>
      <span className="flex items-center gap-1" aria-label={`${s.freezes} ${s.freezes === 1 ? 'freeze' : 'freezes'} left`}>
        {Array.from({ length: s.freezes }, (_, i) => <Snowflake key={i} size={13} aria-hidden="true" style={{ color: '#38BDF8' }} />)}
      </span>
      <span className="num flex min-w-20 items-center justify-end gap-1 whitespace-nowrap text-[14px]" style={{ color: s.current ? 'var(--reward-text)' : 'var(--text-3)' }}>
        <Flame size={14} aria-hidden="true" />
        {unitShort(s, s.current)}
      </span>
      {showBest ? <span className="num min-w-16 whitespace-nowrap text-right text-[13px]" style={{ color: 'var(--text-2)' }}>Best {s.best}</span> : null}
      {onShare ? (
        <button type="button" onClick={() => onShare(s)} aria-label={`Share ${s.name} streak`} className="press -mr-2 flex size-11 items-center justify-center rounded-[10px]" style={{ color: 'var(--text-2)' }}>
          <Share2 size={16} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

/** Top 5 habits by current streak. "Details ›" lists every habit with its best. Never "lost" or "broken". */
export default function StreakCard({ streaks: all, onShare, hideClimb = false }: { streaks: Streak[]; onShare?: (s: Streak) => void; hideClimb?: boolean }) {
  // With climbing logs, the climbing streak lives on Climbing, so a climbing habit shows no second streak here.
  const streaks = hideClimb ? all.filter((s) => habitIcon(s.name) !== 'climb') : all;
  const [open, setOpen] = useState(false);
  const top = streaks.filter((s) => s.current > 0).slice(0, 5);
  return (
    <Section question="Streaks" onDetails={streaks.length ? () => setOpen(true) : undefined}>
      {top.length ? (
        <ul>{top.map((s) => <Row key={s.id} s={s} onShare={onShare} />)}</ul>
      ) : (
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>Tick a habit today to start one.</p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Streaks" subtitle="Every good habit" initialFocus="panel">
        <ul className="pt-1">{streaks.map((s) => <Row key={s.id} s={s} onShare={onShare} showBest />)}</ul>
        <p className="mt-3 text-[13px]" style={{ color: 'var(--text-3)' }}>
          A freeze covers one missed day (a week for weekly habits) once it is more than 7 days old. You earn one every 7 days kept, up to 2.
        </p>
      </Sheet>
    </Section>
  );
}
