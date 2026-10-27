'use client';

import { useEffect, useSyncExternalStore } from 'react';

type ToastAction = { label: string; run: () => void };
type ToastItem = { id: number; msg: string; action?: ToastAction; ms: number };

// One toast at a time: a new one replaces the old one. Kept outside React so any component can call show().
let current: ToastItem | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function set(item: ToastItem | null) {
  current = item;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const api = {
  show(msg: string, action?: ToastAction, ms = 6000) {
    set({ id: nextId++, msg, action, ms });
  },
};

/** `show(msg, action?, ms = 6000)`. Mount one ToastHost for the toast to appear. */
export function useToast(): { show: (msg: string, action?: ToastAction, ms?: number) => void } {
  return api;
}

/** Fixed above the bottom tabs on a phone (tabs are 56px + safe area), above sheets (z-50). */
export function ToastHost() {
  const item = useSyncExternalStore(subscribe, () => current, () => null);

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => { if (current?.id === item.id) set(null); }, item.ms);
    return () => clearTimeout(t);
  }, [item]);

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] sm:bottom-4">
      <div role="status" className="w-full max-w-sm">
        {item && (
          <div
            key={item.id}
            className="pop-in pointer-events-auto flex w-full items-center gap-2 rounded-[10px] border py-1 pl-4 pr-1"
            style={{ background: 'var(--surface-3)', borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-pop)' }}
          >
            <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--text-1)' }}>{item.msg}</span>
            {item.action && (
              <button
                type="button"
                className="min-h-11 min-w-11 shrink-0 rounded-[8px] px-3 text-[14px] font-semibold hover:bg-[var(--surface-2)]"
                style={{ color: 'var(--accent)' }}
                onClick={() => { const run = item.action!.run; set(null); run(); }}
              >
                {item.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
