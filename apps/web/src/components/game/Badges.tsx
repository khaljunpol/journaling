'use client';

import { useState } from 'react';
import { Award } from 'lucide-react';
import { BADGES } from '@journaling/core/badges';

/** One line: how many badges, and the next one. Tap to see the earned ones. No empty slots for things not earned yet. */
export default function Badges({ badges, next }: { badges: Record<string, string>; next: { id: string; label: string } | null }) {
  const earned = BADGES.filter((b) => badges[b.id]);
  const [open, setOpen] = useState(false);
  const summary = `${earned.length} ${earned.length === 1 ? 'badge' : 'badges'}${next ? ` · next: ${next.label}` : ''}`;
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={!earned.length}
        className="press flex min-h-14 w-full items-center gap-2 px-4 py-3 text-left text-[15px] sm:px-5"
        style={{ color: 'var(--text-1)' }}
      >
        <Award size={16} aria-hidden="true" style={{ color: 'var(--reward-text)' }} />
        <span className="min-w-0 flex-1">{summary}</span>
        {earned.length ? <span aria-hidden="true" style={{ color: 'var(--accent)' }}>{open ? '‹' : '›'}</span> : null}
      </button>
      {open ? (
        <ul className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
          {earned.map((b) => (
            <li key={b.id} className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: 'color-mix(in srgb, var(--reward) 16%, var(--surface))', color: 'var(--text-1)' }}>
              <Award size={14} aria-hidden="true" style={{ color: 'var(--reward-text)' }} />
              {b.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
