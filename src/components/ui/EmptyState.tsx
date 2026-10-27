import type { ReactNode } from 'react';

/** One line, one action. */
export default function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{title}</p>
      {hint && <p className="max-w-sm text-[14px]" style={{ color: 'var(--text-2)' }}>{hint}</p>}
      {action}
    </div>
  );
}
