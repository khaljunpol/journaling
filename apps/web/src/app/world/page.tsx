'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { markSeen, seenCount, useWorld } from '@/components/world/useWorld';
import Legend from '@/components/world/Legend';
import WorldScene, { caption, type Pick } from '@/components/world/WorldScene';

const MAX_POP = 6;

/** The Valley, full screen: no frame, the scene fills any screen. Text floats on top: back, level, and one caption. */
export default function WorldPage() {
  const { world, failed } = useWorld();
  const [index, setIndex] = useState<number | null>(null);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [legend, setLegend] = useState(false);
  const [seen] = useState(() => (typeof window === 'undefined' ? 0 : seenCount()));

  const planted = world ? world.valleys.reduce((n, v) => n + v.plantings.length, 0) : 0;
  const shown = index ?? (world ? world.valleys.length - 1 : 0);
  const valley = world?.valleys[shown];

  // New since the last visit: the newest plantings in this valley, at most 6, oldest of them first.
  const fresh = useMemo(() => {
    if (!world || !valley) return new Set<number>();
    const before = world.valleys.slice(0, shown).reduce((n, v) => n + v.plantings.length, 0);
    const start = Math.max(seen - before, valley.plantings.length - MAX_POP, 0);
    return new Set(valley.plantings.slice(start).map((p) => p.tile));
  }, [world, valley, shown, seen]);

  useEffect(() => { if (world) markSeen(planted); }, [world, planted]);

  const text = world && valley ? caption(world, valley, picked) : '';
  const go = (i: number) => { setIndex(i); setPicked(null); };

  return (
    <main className="fixed inset-0 overflow-hidden" style={{ background: '#0B0D14', color: '#F3F5F9' }}>
      {world && valley ? (
        <div className="absolute inset-0 px-2 pb-24 pt-14 sm:pb-20">
          <WorldScene world={world} valley={valley} latest={shown === world.valleys.length - 1} fresh={fresh} picked={picked} onPick={setPicked} />
        </div>
      ) : failed ? (
        <p className="absolute inset-x-0 top-1/3 text-center text-[14px]" style={{ color: '#A4AEC4' }}>Couldn&apos;t load your valley. Try again later.</p>
      ) : null}

      <Link href="/?stay=1" className="press absolute left-2 top-2 flex min-h-11 items-center gap-1 rounded-[10px] px-2 text-[14px]" style={{ color: '#A4AEC4' }}>
        <ChevronLeft size={18} aria-hidden="true" />Overview
      </Link>

      {world && valley ? <Legend world={world} valley={valley} open={legend} onToggle={() => setLegend((o) => !o)} /> : null}

      {world && valley ? (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="min-h-6 rounded-full px-3 py-0.5 text-center text-[14px]" style={{ color: '#F3F5F9', background: text ? 'rgba(11,13,20,0.55)' : 'transparent' }} aria-live="polite">{text}</p>
          <div className="flex items-center gap-2">
            {world.valleys.length > 1 ? (
              <button type="button" aria-label="Previous valley" disabled={shown === 0} onClick={() => go(shown - 1)} className="press flex size-11 items-center justify-center rounded-[10px] disabled:opacity-30">
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
            ) : null}
            <p className="font-pixel rounded-full px-3 py-0.5 text-[16px]" style={{ color: '#F0A24A', background: 'rgba(11,13,20,0.45)' }}>
              Level {world.level}{world.weekGoal.met ? ' · planted this week' : ''}
            </p>
            {world.valleys.length > 1 ? (
              <button type="button" aria-label="Next valley" disabled={shown === world.valleys.length - 1} onClick={() => go(shown + 1)} className="press flex size-11 items-center justify-center rounded-[10px] disabled:opacity-30">
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
