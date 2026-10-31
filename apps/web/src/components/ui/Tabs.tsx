'use client';

import type { ReactNode } from 'react';
import RouteTabs, { useRouteTab, type RouteTab } from '@/components/shell/RouteTabs';

export type { RouteTab };
export { useRouteTab };

/** URL-synced tabs (`?tab=`). The first tab is the default. Wrap pages that use it in Suspense. */
export default function Tabs({ tabs, label }: { tabs: readonly RouteTab[]; label: string }) {
  return <RouteTabs tabs={tabs} label={label} />;
}

/** Panel that pairs with a Tabs item; renders only while its tab is active. */
export function TabPanel({ tabs, id, children }: { tabs: readonly RouteTab[]; id: string; children: ReactNode }) {
  const active = useRouteTab(tabs);
  if (active !== id) return null;
  return <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>{children}</div>;
}
