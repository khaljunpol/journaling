"use client";

import AccountSwitcher from '@/components/AccountSwitcher';
import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AppHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  // Initialize theme from localStorage or fallback to system
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        document.documentElement.setAttribute('data-theme', stored);
      } else {
        // Default to light if no preference stored
        setTheme('light');
        document.documentElement.setAttribute('data-theme', 'light');
        try { localStorage.setItem('theme', 'light'); } catch {}
      }
    } catch {}
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch {}
    document.documentElement.setAttribute('data-theme', next);
  }
  if (pathname?.startsWith('/login')) {
    return null;
  }

  const link = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`rounded-md px-2 py-1.5 whitespace-nowrap transition hover:bg-neutral-100 dark:hover:bg-neutral-900 ${active ? 'font-medium text-(--accent) bg-neutral-100 dark:bg-neutral-900' : 'text-(--text)'}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="mb-4 sm:mb-6 sticky top-0 z-20 border-b" style={{ background: 'color-mix(in oklab, var(--bg) 85%, transparent)' , borderColor: 'var(--border)', backdropFilter: 'saturate(180%) blur(8px)' }}>
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold sm:text-2xl">Journaling</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <AccountSwitcher />
              <button
                onClick={toggleTheme}
                className="btn-outline px-2 py-1 text-xs"
                title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? '🌙' : '☀️'}
              </button>
              <details className="relative">
                <summary className="btn-outline px-2 py-1 text-xs cursor-pointer list-none select-none">⚙️ Settings</summary>
                <div className="absolute right-0 mt-2 w-48 card p-2 space-y-1 z-30">
                  <Link href="/activities" className="block rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-900">Activities</Link>
                  <Link href="/catalog" className="block rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-900">Catalog</Link>
                  <hr className="my-1 border-(--border)" />
                  <div className="px-1">
                    <LogoutButton />
                  </div>
                </div>
              </details>
            </div>
          </div>
          <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-xs sm:gap-2 sm:text-sm">
            {link('/', 'Dashboard')}
            {link('/journal', 'Journal')}
            {link('/mood', 'Mood')}
            {link('/climbing', 'Climbing')}
            {link('/metrics', 'Metrics')}
            <div className="ml-1" />
          </nav>
        </div>
      </div>
    </header>
  );
}
