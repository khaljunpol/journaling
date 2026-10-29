'use client';

import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NAV, OVERVIEW_STAY, navIdForPath } from '@/lib/routes';
import type { NavId } from '@/lib/routes';
import { NAV_ICONS } from './icons';
import MoreSheet from './MoreSheet';

const TAB_IDS: NavId[] = ['today', 'overview', 'progress'];

/** Phone bottom tabs: Today, Overview, Progress, More. 56 px plus the safe area. */
export default function BottomTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const active = navIdForPath(pathname ?? '/');
  const moreActive = active !== null && !TAB_IDS.includes(active);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const tabClass = 'press flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium';

  return (
    <>
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
        {TAB_IDS.map((id) => {
          const item = NAV.find((n) => n.id === id)!;
          const Icon = NAV_ICONS[item.icon];
          const on = active === id;
          return (
            <Link
              key={id}
              href={id === 'overview' ? OVERVIEW_STAY : item.href}
              aria-current={on ? 'page' : undefined}
              className={tabClass}
              style={{ color: on ? 'var(--accent)' : 'var(--text-2)' }}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={tabClass}
          style={{ color: moreActive ? 'var(--accent)' : 'var(--text-2)' }}
        >
          <Ellipsis size={20} strokeWidth={1.5} aria-hidden="true" />
          More
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={closeMore} />
    </>
  );
}
