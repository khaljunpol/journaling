'use client';

import { useMemo } from 'react';

const COLORS = ['var(--reward)', 'var(--accent)', '#f6c789', '#a78bfa'];

/**
 * About 40 pieces, ember and violet, 900ms, transform and opacity only, then gone. Never blocks a tap.
 * Reduced motion: no pieces, only a 120ms fade of the "Perfect day" text (see globals.css).
 */
export default function Confetti({ points }: { points: number }) {
  const pieces = useMemo(
    () => Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 40) * Math.PI * 2 + (i % 3) * 0.2;
      const dist = 90 + ((i * 37) % 90);
      return {
        x: Math.round(Math.cos(angle) * dist),
        y: Math.round(Math.sin(angle) * dist * 0.7 + 60),
        r: (i * 47) % 360,
        d: (i % 5) * 18,
        c: COLORS[i % COLORS.length],
        w: i % 2 ? 6 : 8,
      };
    }),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center" aria-hidden="true">
      <div className="relative">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece absolute left-1/2 top-1/2 block rounded-[2px]"
            style={{ width: p.w, height: p.w * 1.6, background: p.c, animationDelay: `${p.d}ms`, ['--cx' as string]: `${p.x}px`, ['--cy' as string]: `${p.y}px`, ['--cr' as string]: `${p.r}deg` }}
          />
        ))}
        <div className="perfect-text rounded-[14px] px-5 py-3 text-center" style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}>
          <div className="font-pixel text-[26px] leading-none" style={{ color: 'var(--reward-text)' }}>Perfect day</div>
          <div className="num mt-1 text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>+{points}</div>
        </div>
      </div>
    </div>
  );
}
