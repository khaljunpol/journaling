'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NAV, OVERVIEW_STAY, PHONE_MAX_WIDTH } from '@/lib/routes';
import BottomTabs from './BottomTabs';
import Sidebar from './Sidebar';

const STORE_KEY = 'sidebar-expanded';

function typingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node?.tagName) return false;
  const tag = node.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable;
}

/** Sidebar on 640 px and up, bottom tabs below. Also owns the page keys. */
export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    try { setExpanded(localStorage.getItem(STORE_KEY) === '1'); } catch { /* keep the rail */ }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (typingTarget(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const item = NAV.find((n) => n.key === e.key);
      if (!item) return;
      e.preventDefault();
      // On a phone-width window, `/` would bounce to Today, so keep it.
      const href = item.id === 'overview' && window.innerWidth <= PHONE_MAX_WIDTH ? OVERVIEW_STAY : item.href;
      router.push(href);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  function toggle() {
    setAnimate(true);
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem(STORE_KEY, next ? '1' : '0'); } catch { /* not saved */ }
  }

  return (
    <div className={`min-h-dvh sm:pl-16 ${expanded ? 'lg:pl-[220px]' : ''} ${animate ? 'shell-main-anim' : ''}`}>
      <Sidebar expanded={expanded} animate={animate} onToggle={toggle} />
      <main
        className="mx-auto w-full max-w-5xl px-4 pb-[calc(56px+env(safe-area-inset-bottom)+24px)] pt-4 sm:px-8 sm:pb-6 sm:pt-6"
      >
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
