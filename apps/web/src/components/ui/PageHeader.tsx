import { Settings } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PageHeader({ title, context, actions }: { title: string; context?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 tabIndex={-1} className="text-[24px] font-semibold leading-tight outline-none" style={{ color: 'var(--text-1)' }}>{title}</h1>
        {context && <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>{context}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {/* Phones have no Settings tab: the gear sits in every page header. */}
        <Link href="/settings" aria-label="Settings" className="press flex size-11 items-center justify-center rounded-[10px] sm:hidden" style={{ color: 'var(--text-2)' }}>
          <Settings size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
