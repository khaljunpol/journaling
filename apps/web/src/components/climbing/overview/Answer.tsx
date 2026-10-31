import { Fragment, type ReactNode } from 'react';
import { ANSWER_CLASS } from './types';

/** A one-line answer in the sans font. Parts never break inside, so a narrow phone wraps between them. Wrap numbers in `.num`. */
export default function Answer({ parts, className = '' }: { parts: ReactNode[]; className?: string }) {
  return (
    <p className={`${ANSWER_CLASS} ${className}`} style={{ color: 'var(--text-1)' }}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? ' · ' : null}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </p>
  );
}
