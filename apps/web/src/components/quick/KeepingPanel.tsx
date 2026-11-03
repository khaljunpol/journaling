'use client';

import { useEffect, useState } from 'react';
import KeepingCard from '@/components/overview/KeepingCard';
import type { KeepingUp } from '@journaling/core/keepingUp';
import type { QuickPayload } from '@journaling/core/quickPayload';
import { addDaysISO } from '@journaling/core/quickWeek';
import { KEEPING_DAYS, QUICK_MAX_DAYS, keepingFromPayloads, rangeChunks } from '@/lib/keepingRange';

/** Keeping up (the last 4 weeks of logging), at the top of Catch up: it says which days need filling in. Reads again when `refresh` changes. */
export default function KeepingPanel({ today, refresh = 0 }: { today: string; refresh?: number }) {
  const [keeping, setKeeping] = useState<KeepingUp | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const chunks = rangeChunks(addDaysISO(today, -(KEEPING_DAYS - 1)), today, QUICK_MAX_DAYS);
    Promise.all(
      chunks.map(([from, to]) =>
        fetch(`/api/quick?from=${from}&to=${to}`, { signal: ctrl.signal })
          .then((r) => (r.ok ? (r.json() as Promise<QuickPayload>) : null))
          .catch(() => null),
      ),
    ).then((parts) => {
      if (ctrl.signal.aborted) return;
      // All reads must land, or a missing chunk would show its days as missed.
      if (parts.some((p) => !p)) return;
      setKeeping(keepingFromPayloads(today, parts));
    });
    return () => ctrl.abort();
  }, [today, refresh]);
  return keeping ? <KeepingCard keeping={keeping} /> : null;
}
