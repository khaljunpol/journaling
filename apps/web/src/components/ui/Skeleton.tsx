/** Placeholder block. The pulse only runs when motion is allowed. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-[10px] bg-[var(--surface-3)] ${className}`} />;
}
