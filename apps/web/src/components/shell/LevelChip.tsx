'use client';

import { Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchGame } from '@/components/game/useGame';
import { getCache, setCache } from '@/lib/cache';

/** Ember pill: the game level. Cached numbers first; hidden until the level is known or if the read fails. */
export default function LevelChip({ compact = false }: { compact?: boolean }) {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Cached level after mount, so the server render and the first client render match.
    const cached = getCache<{ level?: unknown }>('game:state')?.data?.level;
    if (typeof cached === 'number') setLevel(cached);
    (async () => {
      try {
        const data: unknown = await fetchGame();
        const lv = (data as { level?: unknown })?.level;
        if (typeof lv !== 'number' || cancelled) return;
        setLevel(lv);
        try {
          const prev = getCache<Record<string, unknown>>('game:state')?.data ?? {};
          setCache('game:state', { ...prev, level: lv });
        } catch { /* cache is optional */ }
      } catch { /* chip stays as it was */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (level === null) return null;

  return (
    <Link
      href="/progress"
      aria-label={`Level ${level}. Open Progress`}
      title={`Level ${level}`}
      className={`num inline-flex items-center gap-1 rounded-full font-medium ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]'}`}
      style={{ background: 'var(--reward)', color: 'var(--on-reward)' }}
    >
      <Star size={compact ? 12 : 14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
      <span className="font-pixel whitespace-nowrap">{level}</span>
    </Link>
  );
}
