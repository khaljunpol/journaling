'use client';

import { LogOut, Moon, NotebookPen, PanelLeft, Sun, Unplug, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useDemo } from '@/components/Providers';
import { NAV, navIdForPath } from '@/lib/routes';
import type { NavItem } from '@/lib/routes';
import { signOutClean } from '@/lib/signOut';
import { NAV_ICONS } from './icons';
import { disconnectSheet } from './disconnectSheet';
import LevelChip from './LevelChip';
import { useTheme } from './useTheme';

type Props = { expanded: boolean; animate: boolean; onToggle: () => void };

const itemBase = 'group relative flex h-10 items-center gap-3 rounded-[10px] px-[14px] text-[14px] font-medium';

function Tip({ text, hint, show }: { text: string; hint?: string; show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-[8px] border px-2 py-1 text-[12px] group-hover:flex group-focus-visible:flex"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)', color: 'var(--text-1)', boxShadow: 'var(--shadow-pop)' }}
    >
      {text}
      {hint && <kbd className="num rounded border px-1 text-[11px]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-2)' }}>{hint}</kbd>}
    </span>
  );
}

/** Icon rail (64 px). On wide screens it expands to 220 px with labels. Hidden on phones. */
export default function Sidebar({ expanded, animate, onToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const demo = useDemo();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = navIdForPath(pathname ?? '/');

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Labels only show on wide screens; the rail is icons-only below 1024 px.
  const labelClass = `sidebar-label hidden lg:block whitespace-nowrap ${expanded ? 'opacity-100' : 'opacity-0'}`;
  const tipsOn = !expanded;

  const link = (item: NavItem) => {
    const Icon = NAV_ICONS[item.icon];
    const on = active === item.id;
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-label={item.label}
        aria-current={on ? 'page' : undefined}
        aria-keyshortcuts={item.key}
        className={itemBase}
        style={{ background: on ? 'var(--accent-soft)' : undefined, color: on ? 'var(--accent)' : 'var(--text-2)' }}
      >
        <Icon size={20} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
        <span className={labelClass} aria-hidden="true">{item.label}</span>
        <Tip text={item.label} hint={item.key} show={tipsOn} />
      </Link>
    );
  };

  const main = NAV.filter((n) => n.id !== 'settings');
  const settings = NAV.find((n) => n.id === 'settings')!;
  const menuItem = 'flex min-h-10 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[14px]';

  return (
    <aside
      aria-label="Sidebar"
      data-expanded={expanded}
      className={`fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r px-[9px] py-3 sm:flex ${expanded ? 'lg:w-[220px]' : ''} ${animate ? 'sidebar-anim' : ''}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex h-10 items-center gap-3 px-[10px]">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          style={{ color: 'var(--accent)' }}
          aria-hidden="true"
        >
          <NotebookPen size={20} strokeWidth={1.5} />
        </span>
        <span className={`${labelClass} text-[15px] font-semibold`} style={{ color: 'var(--text-1)' }}>Journaling</span>
      </div>
      <div className="mt-2 flex h-8 justify-center lg:justify-start lg:pl-[9px]">
        <LevelChip compact />
      </div>

      <nav aria-label="Main" className="mt-3 flex flex-col gap-1">
        {main.map(link)}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {link(settings)}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${itemBase.replace('h-10', 'h-11')} w-full`}
            style={{ color: 'var(--text-2)' }}
          >
            <User size={20} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
            <span className={labelClass} aria-hidden="true">Account</span>
            {!menuOpen && <Tip text="Account" show={tipsOn} />}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="pop-in absolute bottom-0 left-full z-50 ml-2 w-52 rounded-[10px] border p-1"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-pop)' }}
            >
              <button role="menuitem" type="button" onClick={toggle} className={menuItem} style={{ color: 'var(--text-1)' }}>
                {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              {!demo && (
                <>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => { setMenuOpen(false); void disconnectSheet((p) => router.push(p)); }}
                    className={menuItem}
                    style={{ color: 'var(--text-1)' }}
                  >
                    <Unplug size={16} aria-hidden="true" />
                    Disconnect sheet
                  </button>
                  <button role="menuitem" type="button" onClick={() => void signOutClean()} className={menuItem} style={{ color: 'var(--text-1)' }}>
                    <LogOut size={16} aria-hidden="true" />
                    Sign out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-pressed={expanded}
          className={`${itemBase} hidden w-full lg:flex`}
          style={{ color: 'var(--text-3)' }}
        >
          <PanelLeft size={20} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
          <span className={labelClass} aria-hidden="true">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
