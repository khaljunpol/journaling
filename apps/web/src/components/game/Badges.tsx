import { Award } from 'lucide-react';
import { Section } from '@/components/overview/Section';
import { BADGES } from '@journaling/core/badges';

/** Earned badges only, plus one line for the next. No empty slots for things not earned yet. */
export default function Badges({ badges, next }: { badges: Record<string, string>; next: { id: string; label: string } | null }) {
  const earned = BADGES.filter((b) => badges[b.id]);
  return (
    <Section question="Badges">
      {earned.length ? (
        <ul className="flex flex-wrap gap-2">
          {earned.map((b) => (
            <li key={b.id} className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: 'color-mix(in srgb, var(--reward) 16%, var(--surface))', color: 'var(--text-1)' }}>
              <Award size={14} aria-hidden="true" style={{ color: 'var(--reward-text)' }} />
              {b.label}
            </li>
          ))}
        </ul>
      ) : null}
      {next ? <p className="mt-3 text-[13px]" style={{ color: 'var(--text-2)' }}>Next: {next.label}</p> : null}
    </Section>
  );
}
