"use client";

import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

export default function AccountSwitcher() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const active = session?.activeSubAccount || '';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  async function switchTo(name: string) {
    setOpen(false);
    await update({ activeSubAccount: name });
    window.location.reload();
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    setOpen(false);
    await update({ activeSubAccount: name });
    window.location.reload();
  }

  if (!session) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-outline px-2.5 py-1 text-sm flex items-center gap-1.5"
        aria-expanded={open}
        title="Switch account"
      >
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{active || '—'}</span>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-52 card p-2 z-40 shadow-lg space-y-1"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="px-2 py-1 text-xs uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
            Switch account
          </div>

          {active && (
            <button
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm"
              style={{ background: 'var(--surface-alt)', color: 'var(--accent)', fontWeight: 500 }}
              onClick={() => setOpen(false)}
            >
              {active}
              <span className="text-xs">✓</span>
            </button>
          )}

          <div className="my-1 h-px" style={{ background: 'var(--border)' }} />

          <div className="px-2 py-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Switch to another account
          </div>
          <form onSubmit={onAdd} className="flex gap-1 px-1">
            <input
              autoFocus
              type="text"
              className="input flex-1 py-1 text-sm"
              placeholder="e.g. Sam"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn px-2 py-1 text-sm">Go</button>
          </form>
        </div>
      )}
    </div>
  );
}
