'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Layer } from '@journaling/core/yearDays';

const LABELS: Record<Layer, string> = { mood: 'Mood', habits: 'Habits', sleep: 'Sleep', points: 'Points' };

/** The calendar layer from `?layer=`. Unknown or unavailable values fall back to Mood. */
export function useLayer(available: readonly Layer[]): Layer {
  const v = useSearchParams().get('layer') as Layer | null;
  return v && available.includes(v) ? v : 'mood';
}

/** Small segmented control. Keeps the other query values (the Trends tab). */
export default function LayerControl({ layers, value }: { layers: readonly Layer[]; value: Layer }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pick = (l: Layer) => {
    const next = new URLSearchParams(params.toString());
    next.set('layer', l);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return (
    <div role="radiogroup" aria-label="Calendar layer" className="inline-flex rounded-full p-0.5" style={{ background: 'var(--surface-2)' }}>
      {layers.map((l) => {
        const on = l === value;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(l)}
            className="press min-h-11 rounded-full px-3.5 text-[14px] font-medium"
            style={{ background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-2)' }}
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
