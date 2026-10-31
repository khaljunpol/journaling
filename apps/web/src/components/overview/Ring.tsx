'use client';

import { useEffect, useRef } from 'react';

/** Today ring. Violet while filling, ember once every item is in. Own SVG. Pops and buzzes once, only when it closes while mounted. */
export default function Ring({ filled, total, size = 56 }: { filled: number; total: number; size?: number }) {
  const stroke = size < 40 ? 3 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const closed = total > 0 && filled >= total;
  const share = total > 0 ? Math.min(1, filled / total) : 0;
  const groupRef = useRef<SVGGElement | null>(null);
  const wasClosed = useRef(closed);
  useEffect(() => {
    const was = wasClosed.current;
    wasClosed.current = closed;
    if (was || !closed) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const g = groupRef.current;
    if (g) {
      g.classList.remove('ring-pop-play');
      void g.getBoundingClientRect();
      g.classList.add('ring-pop-play');
    }
    const t = setTimeout(() => navigator.vibrate?.(10), 300); // after the arc closes
    return () => clearTimeout(t);
  }, [closed]);
  const color = closed ? 'var(--reward)' : 'var(--accent)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={closed ? 'Day complete' : `${filled} of ${total} done`} className="shrink-0">
      <g ref={groupRef} onAnimationEnd={(e) => e.currentTarget.classList.remove('ring-pop-play')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </g>
    </svg>
  );
}
