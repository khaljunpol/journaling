'use client';

import { Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Sidequest } from '@/lib/types';

/** Ember pill: sidequests completed this year. Hidden until the count is known. */
export default function LevelChip({ compact = false }: { compact?: boolean }) {
  const [done, setDone] = useState<number | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sidequests?year=${year}`);
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!Array.isArray(data) || cancelled) return;
        setDone((data as Sidequest[]).filter((s) => !!s.completedAt).length);
      } catch { /* chip stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, [year]);

  if (done === null) return null;

  return (
    <Link
      href="/progress"
      aria-label={`${done} sidequests done in ${year}. Open Progress`}
      title={`${done} sidequests done in ${year}`}
      className={`num inline-flex items-center gap-1 rounded-full font-medium ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]'}`}
      style={{ background: 'var(--reward)', color: 'var(--on-reward)' }}
    >
      <Star size={compact ? 12 : 14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
      {done}
    </Link>
  );
}
