import type { ReactNode } from 'react';

/** Surface with a 14px radius and token shadow. Padding 16 on phone, 20 from sm. */
export function Card({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' }) {
  return <Tag className={`card p-4 sm:p-5 ${className}`}>{children}</Tag>;
}

export function CardHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h3>
      {meta}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
