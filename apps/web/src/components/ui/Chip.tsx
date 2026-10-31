import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'ok';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--surface-2)', fg: 'var(--text-2)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  ok: { bg: 'var(--ok-soft)', fg: 'var(--ok)' },
};

/** Small pill. No red tone on purpose: use it for counts and labels, not for warnings. */
export default function Chip({ children, tone = 'neutral', color }: { children: ReactNode; tone?: Tone; color?: string }) {
  const t = TONE[tone];
  return (
    <span
      className="num inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-medium"
      style={color ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, color } : { background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}
