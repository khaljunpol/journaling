import type { SelectHTMLAttributes } from 'react';
import { fieldBase } from './Input';

export default function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldBase} min-h-11 px-3 ${className}`} {...rest} />;
}
