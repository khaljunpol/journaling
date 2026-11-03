'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import type { useGame } from './useGame';

const fmt = (n: number) => n.toLocaleString('en-US');

/** "Level 4 · 120 to level 5", an ember bar, then Points · Perfect days · Today. Before the import: one line and "Count my history". */
export default function LevelCard({ game }: { game: ReturnType<typeof useGame> }) {
  const { numbers, state, failed, runImport } = game;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!numbers) {
    return (
      <Card as="section">
        {failed ? <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>Couldn&apos;t load your level. Try again later.</p> : (
          <>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-3 h-2.5 w-full" />
            <Skeleton className="mt-4 h-10 w-full" />
          </>
        )}
      </Card>
    );
  }

  const { level, into, cost, toNext, points, perfectDays, today, imported } = numbers;
  const pct = cost ? Math.min(100, Math.round((into / cost) * 100)) : 0;
  const stats = [
    { label: 'Points', value: fmt(points) },
    { label: 'Perfect days', value: fmt(perfectDays) },
    { label: 'Today', value: today.total ? `${Math.min(today.done, today.total)} of ${today.total}` : '–' },
  ];

  async function count() {
    setBusy(true);
    setError(false);
    const ok = await runImport();
    setBusy(false);
    setError(!ok);
  }

  return (
    <Card as="section" className="space-y-4">
      <div>
        <h2 className="text-[18px] font-medium" style={{ color: 'var(--text-1)' }}>
          <span className="font-pixel" style={{ color: 'var(--reward-text)' }}>Level {level}</span>
          <span style={{ color: 'var(--text-2)' }}> · <span className="num" style={{ color: 'var(--text-1)' }}>{fmt(toNext)}</span> to level {level + 1}</span>
        </h2>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full"
          style={{ background: 'var(--surface-3)' }}
          role="progressbar"
          aria-label={`Level ${level} progress`}
          aria-valuemin={0}
          aria-valuemax={cost}
          aria-valuenow={into}
        >
          <span className="bar-x block h-full" style={{ transform: `scaleX(${pct / 100})`, background: 'var(--reward)' }} />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>{s.label}</dt>
            <dd className="num mt-0.5 whitespace-nowrap text-[19px] font-medium leading-tight sm:text-[22px]" style={{ color: 'var(--text-1)' }}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {!imported && state ? (
        <div className="flex flex-col gap-3 rounded-[10px] p-3 sm:flex-row sm:items-center" style={{ background: 'var(--surface-2)' }}>
          <p className="min-w-0 flex-1 text-[14px]" style={{ color: 'var(--text-2)' }}>
            Your history is ready. Saving it keeps old days fixed when habits change.
          </p>
          <Button className="w-full sm:w-auto" onClick={count} disabled={busy}>{busy ? 'Counting…' : 'Count my history'}</Button>
          {error ? <p role="alert" className="w-full text-[13px]" style={{ color: 'var(--text-2)' }}>Couldn&apos;t save. Try again.</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
