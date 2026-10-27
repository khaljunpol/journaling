import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export const fieldBase =
  'rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[14px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--ring)]';

/** Single-line field: full width, 44px tall. */
export const fieldClass = `${fieldBase} min-h-11 w-full px-3`;

export default function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} w-full px-3 py-2 ${className}`} {...rest} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>
      {children}
    </label>
  );
}
