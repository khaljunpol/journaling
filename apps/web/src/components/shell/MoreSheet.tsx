'use client';

import { LogOut, Moon, Sun, Unplug } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV } from '@/lib/routes';
import { signOutClean } from '@/lib/signOut';
import { NAV_ICONS } from './icons';
import { disconnectSheet } from './disconnectSheet';
import { useTheme } from './useTheme';

const MORE_IDS = ['trends', 'climbing', 'settings'] as const;
const FOCUSABLE = 'a[href], button:not([disabled])';

const rowClass = 'flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px]';

/** Phone "More" sheet: the pages that are not tabs, plus theme and account. */
export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      // Safety net in case the animation event never fires.
      const t = setTimeout(() => { setMounted(false); setClosing(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mounted, onClose]);

  if (!mounted) return null;

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
      <div
        className={`absolute inset-0 bg-black/50 ${closing ? 'backdrop-out' : 'backdrop-in'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        tabIndex={-1}
        onKeyDown={trapTab}
        onAnimationEnd={() => { if (closing) { setMounted(false); setClosing(false); } }}
        className={`relative w-full max-w-md rounded-t-2xl border-t px-3 pt-3 outline-none ${closing ? 'sheet-out' : 'sheet-in'}`}
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-pop)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full" style={{ background: 'var(--border-strong)' }} aria-hidden="true" />
        <nav aria-label="More pages">
          {MORE_IDS.map((id) => {
            const item = NAV.find((n) => n.id === id)!;
            const Icon = NAV_ICONS[item.icon];
            return (
              <Link key={id} href={item.href} onClick={onClose} className={rowClass} style={{ color: 'var(--text-1)' }}>
                <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="my-2 h-px" style={{ background: 'var(--border)' }} />
        <button type="button" onClick={toggle} className={rowClass} style={{ color: 'var(--text-1)' }}>
          {theme === 'dark'
            ? <Sun size={20} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
            : <Moon size={20} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} aria-hidden="true" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          type="button"
          onClick={() => { onClose(); void disconnectSheet((p) => router.push(p)); }}
          className={rowClass}
          style={{ color: 'var(--text-1)' }}
        >
          <Unplug size={20} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
          Disconnect sheet
        </button>
        <button type="button" onClick={() => void signOutClean()} className={rowClass} style={{ color: 'var(--text-1)' }}>
          <LogOut size={20} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}
