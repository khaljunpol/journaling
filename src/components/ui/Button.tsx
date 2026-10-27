import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-[var(--accent-fill)] text-[var(--on-accent-fill)] hover:brightness-95',
  outline: 'border border-[var(--border-strong)] bg-transparent text-[var(--text-1)] hover:bg-[var(--surface-2)]',
  ghost: 'bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean };

/** 10px radius. Default height 44px (tap target); `small` is a compact look (13px text); the hit area stays 44px. */
export default function Button({ variant = 'primary', small = false, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-4 text-[14px] font-medium disabled:opacity-50 min-h-11 ${small ? 'min-w-11 text-[13px]' : ''} ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}
