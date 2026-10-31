'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type RouteTab = { id: string; label: string };

/** Reads the active tab from `?tab=`. Unknown or missing values fall back to the first tab. */
export function useRouteTab(tabs: readonly RouteTab[]): string {
  const value = useSearchParams().get('tab');
  return tabs.some((t) => t.id === value) ? (value as string) : tabs[0].id;
}

/** Segmented control that keeps the tab in the URL. Scrolls sideways on a narrow phone. */
export default function RouteTabs({ tabs, label }: { tabs: readonly RouteTab[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const active = useRouteTab(tabs);
  const go = useCallback(
    (id: string) => router.replace(`${pathname}?tab=${id}`, { scroll: false }),
    [router, pathname],
  );

  return (
    <div role="tablist" aria-label={label} className="nav-scroll -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`panel-${t.id}`}
            onClick={() => go(t.id)}
            className="min-h-11 shrink-0 rounded-full px-4 text-[14px] font-medium"
            style={{
              background: on ? 'var(--accent-soft)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text-2)',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
