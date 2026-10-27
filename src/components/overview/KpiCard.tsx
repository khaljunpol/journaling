import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

/** Label, big mono number, optional chip and a visual (sparkline or ring). The whole card is a link. */
export default function KpiCard({
  label,
  value,
  unit,
  sub,
  chip,
  visual,
  href,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: string;
  chip?: ReactNode;
  visual?: ReactNode;
  href: string;
  loading?: boolean;
}) {
  return (
    <Link href={href} className="block h-full rounded-[14px]">
      <Card className="flex h-full min-h-[132px] flex-col gap-2 hover:border-[var(--border-strong)]">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>{label}</div>
        {loading ? (
          <>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-7 w-full" />
          </>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <div className="num text-[28px] font-medium leading-none" style={{ color: 'var(--text-1)' }}>
                {value}
                {unit && <span className="ml-1 text-[13px]" style={{ color: 'var(--text-2)' }}>{unit}</span>}
              </div>
              {visual && <div className="min-w-0 flex-1 pl-1">{visual}</div>}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
              {chip}
              {sub && <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</span>}
            </div>
          </>
        )}
      </Card>
    </Link>
  );
}
