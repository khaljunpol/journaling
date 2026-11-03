'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchGame } from '@/components/game/useGame';

/** A small window onto the valley: the sunrise sky and the horizon, one line, and a way in. */
export default function WorldTile() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchGame().then((g) => {
      if (cancelled || !g.world) return;
      const t = g.world.tallest;
      setLine(g.world.weekMet ? 'Planted this week' : t && t.tiles >= 1 ? `${t.name} is ${Math.round(t.tiles * 10) / 10} tiles tall` : 'Your valley');
    }).catch(() => setLine('Your valley'));
    return () => { cancelled = true; };
  }, []);
  return (
    <Link href="/world" className="press card relative block overflow-hidden p-0" aria-label={`Open your valley. ${line ?? ''}`}>
      <div aria-hidden="true" className="h-20" style={{ background: 'linear-gradient(to bottom, #0B0D14 0%, #3B2747 55%, #F0A24A 100%)' }}>
        <div className="absolute left-1/2 top-[44px] h-9 w-40 -translate-x-1/2" style={{ background: '#3B2F55', clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
      </div>
      <div className="h-3" style={{ background: '#4F9A4E' }} aria-hidden="true" />
      <div className="flex min-h-12 items-center gap-2 px-4 py-2 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium" style={{ color: 'var(--text-1)' }}>Valley</span>
          <span className="block truncate text-[13px]" style={{ color: 'var(--text-2)' }}>{line ?? ' '}</span>
        </span>
        <span aria-hidden="true" style={{ color: 'var(--accent)' }}>›</span>
      </div>
    </Link>
  );
}
