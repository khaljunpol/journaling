'use client';

import Link from 'next/link';
import { useDemo } from '@/components/Providers';

const REPO_URL = 'https://github.com/khaljunpol/journaling';

const linkClass = 'press inline-flex min-h-11 sm:min-h-8 items-center rounded-[8px] px-1.5 font-medium underline-offset-4 hover:underline';

/** One line at the top of the shell, shown only in demo mode: what this is and where to start. */
export default function DemoBanner() {
  if (!useDemo()) return null;
  return (
    <nav
      aria-label="Demo"
      className="flex flex-wrap items-center justify-center gap-x-1 px-4 pt-[calc(env(safe-area-inset-top)+8px)] text-[13px]"
      style={{ color: 'var(--text-2)' }}
    >
      <span className="px-1.5">Demo with sample data · changes reset</span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      {/* The links stay together, so a narrow screen breaks the line before them, not between them. */}
      <span className="inline-flex items-center gap-x-1">
        <Link href="/quick" className={linkClass} style={{ color: 'var(--accent)' }}>Log today</Link>
        <span aria-hidden="true">·</span>
        <Link href="/world" className={linkClass} style={{ color: 'var(--accent)' }}>See your valley</Link>
        <span aria-hidden="true">·</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={linkClass} style={{ color: 'var(--accent)' }}>
          GitHub<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </span>
    </nav>
  );
}
