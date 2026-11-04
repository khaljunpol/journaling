'use client';

import { useDemo } from '@/components/Providers';

/** One quiet line at the top of the shell, shown only in demo mode. */
export default function DemoBanner() {
  if (!useDemo()) return null;
  return (
    <p
      role="note"
      className="px-4 pt-[calc(env(safe-area-inset-top)+8px)] text-center text-[12px]"
      style={{ color: 'var(--text-2)' }}
    >
      Demo · sample data · changes reset
    </p>
  );
}
