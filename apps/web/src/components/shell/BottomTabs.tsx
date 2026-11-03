'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, PHONE_TABS, navIdForPath } from '@/lib/routes';
import { NAV_ICONS } from './icons';

/** Phone bottom tabs: Today, Home, Insights, You. 56 px plus the safe area. Climbing and Settings are a tap away inside the pages. */
export default function BottomTabs() {
  const pathname = usePathname();
  const active = navIdForPath(pathname ?? '/');
  const tabClass = 'press flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium';

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t sm:hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        height: 'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {PHONE_TABS.map((id) => {
        const item = NAV.find((n) => n.id === id)!;
        const Icon = NAV_ICONS[item.icon];
        const on = active === id;
        return (
          <Link
            key={id}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={tabClass}
            style={{ color: on ? 'var(--accent)' : 'var(--text-2)' }}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
