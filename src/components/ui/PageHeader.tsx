import type { ReactNode } from 'react';

export default function PageHeader({ title, context, actions }: { title: string; context?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 tabIndex={-1} className="text-[24px] font-semibold leading-tight outline-none" style={{ color: 'var(--text-1)' }}>{title}</h1>
        {context && <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>{context}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
