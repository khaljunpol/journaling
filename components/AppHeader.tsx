"use client";

import AccountSwitcher from '@/components/AccountSwitcher';
import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const resolved = stored === 'dark' ? 'dark' : 'light';
      setTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } catch { }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      switch (e.key) {
        case 'd': router.push('/'); break;
        case 'j': router.push('/journal'); break;
        case 't': router.push('/time'); break;
        case 'c': router.push('/climbing'); break;
        case 'm': router.push('/mood'); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch { }
    document.documentElement.setAttribute('data-theme', next);
  }

  if (pathname?.startsWith('/login')) return null;

  const link = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className="rounded-md px-2 py-1.5 whitespace-nowrap transition text-sm"
        style={active
          ? { color: 'var(--accent)', background: 'var(--surface-alt)', fontWeight: 500 }
          : { color: 'var(--text)' }
        }
      >
        {label}
      </Link>
    );
  };

  const settingsRef = useRef<HTMLDetailsElement | null>(null);
  const closeSettings = () => { if (settingsRef.current) settingsRef.current.open = false; };

  return (
    <header
      className="mb-4 sm:mb-6 sticky top-0 z-20 border-b"
      style={{
        background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        borderColor: 'var(--border)',
        backdropFilter: 'saturate(180%) blur(8px)',
      }}
    >
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3">
          {/* Top row */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold sm:text-2xl">Journaling</h1>
            <div className="flex items-center gap-2">
              <AccountSwitcher />

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="btn-outline px-2.5 py-1 text-xs flex items-center gap-1"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <><span>☀️</span><span className="hidden sm:inline">Light</span></>
                ) : (
                  <><span>🌙</span><span className="hidden sm:inline">Dark</span></>
                )}
              </button>

              {/* Settings gear */}
              <details className="relative" ref={settingsRef}>
                <summary
                  className="btn-outline px-2.5 py-1 text-xs cursor-pointer list-none select-none flex items-center gap-1"
                  title="Settings"
                >
                  <span>⚙</span><span className="hidden sm:inline">More</span>
                </summary>
                <div
                  className="absolute right-0 mt-2 w-52 card p-1.5 space-y-0.5 z-30 shadow-lg"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="px-2 py-1 subtle text-xs uppercase tracking-wider">Manage</div>
                  <Link href="/activities" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition" style={{ color: 'var(--text)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')} onMouseLeave={e => (e.currentTarget.style.background = '')} onClick={closeSettings}>Activities</Link>
                  <Link href="/catalog" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition" style={{ color: 'var(--text)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')} onMouseLeave={e => (e.currentTarget.style.background = '')} onClick={closeSettings}>Catalog</Link>
                  <Link href="/time-categories" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition" style={{ color: 'var(--text)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')} onMouseLeave={e => (e.currentTarget.style.background = '')} onClick={closeSettings}>Time Categories</Link>
                  <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
                  <div className="px-2 py-1 subtle text-xs uppercase tracking-wider">Analytics</div>
                  <Link href="/climbing-log" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition" style={{ color: 'var(--text)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')} onMouseLeave={e => (e.currentTarget.style.background = '')} onClick={closeSettings}>Climbing Log</Link>
                  <Link href="/metrics" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition" style={{ color: 'var(--text)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')} onMouseLeave={e => (e.currentTarget.style.background = '')} onClick={closeSettings}>Metrics</Link>
                  <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
                  <div className="px-2 py-1.5" onClick={closeSettings}>
                    <LogoutButton />
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Nav — 5 primary pages */}
          <nav className="flex max-w-full items-center gap-0.5 overflow-x-auto">
            {link('/', 'Dashboard')}
            {link('/journal', 'Journal')}
            {link('/time', 'Time')}
            {link('/climbing', 'Climbing')}
            {link('/mood', 'Mood')}
          </nav>
        </div>
      </div>
    </header>
  );
}
