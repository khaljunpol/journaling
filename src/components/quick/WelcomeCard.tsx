'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import type { WelcomeStep } from '@/lib/quickWelcome';
import Button from '@/components/ui/Button';

const COPY: Record<WelcomeStep['key'], { title: string; hint: string; href?: string; cta?: string }> = {
  habits: { title: 'Add your habits', hint: 'Things you want to do most days.', href: '/settings#activities', cta: 'Add' },
  log: { title: 'Log today', hint: 'Tap a tile below. Mood takes one tap.' },
  reminder: { title: 'Evening reminder', hint: 'Optional. A nudge if the day is still open.', href: '/settings#reminder', cta: 'Turn on' },
};

/** First-run card on Today. Only shown to someone just starting (see lib/quickWelcome.ts). */
export default function WelcomeCard({ steps, onHide }: { steps: WelcomeStep[]; onHide: () => void }) {
  const left = steps.filter((s) => !s.done).length;
  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="welcome-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="welcome-title" className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>Welcome</h2>
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            {left === steps.length ? '3 steps and you are set.' : `${left} to go.`}
          </p>
        </div>
        <Button variant="ghost" small onClick={onHide}>Hide</Button>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const c = COPY[s.key];
          return (
            <li
              key={s.key}
              className="flex min-h-12 items-center gap-3 rounded-[10px] px-3 py-2"
              style={{ background: 'var(--surface-2)' }}
            >
              <span
                className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                style={s.done ? { background: 'var(--ok)', color: 'var(--bg)' } : { background: 'var(--accent-soft)', color: 'var(--accent)' }}
                aria-hidden="true"
              >
                {s.done ? <Check size={15} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[14px] font-medium"
                  style={{ color: s.done ? 'var(--text-2)' : 'var(--text-1)', textDecoration: s.done ? 'line-through' : undefined }}
                >
                  {c.title}
                  {s.done && <span className="sr-only"> (done)</span>}
                </span>
                {!s.done && <span className="block text-[13px]" style={{ color: 'var(--text-2)' }}>{c.hint}</span>}
              </span>
              {!s.done && c.href && (
                <Link href={c.href} className="press inline-flex min-h-11 items-center rounded-[10px] px-3 text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
                  {c.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
