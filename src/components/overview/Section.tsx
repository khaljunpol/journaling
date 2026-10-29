import Link from 'next/link';
import type { ReactNode } from 'react';
import { ANSWER_CLASS, QUESTION_CLASS } from '@/components/climbing/overview/types';
import { Card } from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

/** One Overview question: the question, "Details ›" top right, then the answer and one chart. Full height so a row lines up. */
export function Section({ question, onDetails, children }: { question: string; onDetails?: () => void; children: ReactNode }) {
  return (
    <Card as="section" className="flex h-full flex-col">
      <div className="flex min-h-11 items-center gap-2">
        <h2 className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>{question}</h2>
        {onDetails ? (
          <button type="button" className="press -mr-2 ml-auto flex min-h-11 items-center rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={onDetails}>
            Details ›
          </button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Same size as a loaded section, so nothing moves when the data lands. `rows` = the time chart shape. */
export function SectionSkeleton({ question, rows = false }: { question: string; rows?: boolean }) {
  return (
    <Section question={question}>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      {rows ? (
        <div className="mt-auto box-content h-[140px] space-y-1 pt-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      ) : (
        <div className="mt-auto pt-4"><Skeleton className="h-24 w-full" /></div>
      )}
    </Section>
  );
}

/** A one-sentence answer that may wrap (empty and quiet lines): `Answer` keeps each part on one line. */
export function PlainAnswer({ children }: { children: ReactNode }) {
  return <p className={ANSWER_CLASS} style={{ color: 'var(--text-1)' }}>{children}</p>;
}

/** 13px secondary line under an answer. */
export function SubLine({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>{children}</p>;
}

/** Quiet next step for an empty section ("Add habits ›"). */
export function NextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press -ml-2 mt-1 inline-flex min-h-11 items-center self-start rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }}>
      {children}
    </Link>
  );
}

/** "+0.4 vs last week" / "−3h vs last week" / "same as last week". U+2212 minus, never red. */
export function signed(delta: number, unit = ''): string {
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)}${unit}`;
}
