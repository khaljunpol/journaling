'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

let pendingBack: ReturnType<typeof setTimeout> | null = null;

/** Another layer (the card stack) opening in the same tap takes over the Sheet's history entry: cancels the pending back. */
export function adoptSheetEntry(): boolean {
  if (pendingBack === null) return false;
  clearTimeout(pendingBack);
  pendingBack = null;
  return true;
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 'field' (default) focuses the first input; 'panel' focuses the panel, so no phone keyboard pops up. */
  initialFocus?: 'field' | 'panel';
  children: ReactNode;
};

/**
 * Bottom sheet under 1024 px, side panel from 1024 px. Focus is trapped, Escape and the
 * browser Back button close it, and focus returns to the opener. z-50 sits above the bottom tabs (z-40).
 */
export default function Sheet({ open, onClose, title, subtitle, initialFocus = 'field', children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // The open animation is done: the panel's transform is free for dragging.
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  // Phone drag-to-close. `dismissed`: the drag already slid the panel out, so skip the close animation.
  const drag = useRef<{ id: number; startY: number; startT: number; dy: number } | null>(null);
  const dismissed = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dismissed.current = false;
      setMounted(true);
      setClosing(false);
      setEntered(false);
      // Safety net: animationend never fires when animations are paused (background tab, animations off).
      const t = setTimeout(() => setEntered(true), 300);
      return () => clearTimeout(t);
    } else if (mounted) {
      if (dismissed.current) { setMounted(false); return; }
      setClosing(true);
      const t = setTimeout(() => { setMounted(false); setClosing(false); }, 300); // safety net
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // The Back button closes the sheet instead of leaving the page. We only call
  // history.back() ourselves when the close did not come from popstate, and only
  // if our own entry is still the current one (safe when StrictMode re-runs the effect).
  useEffect(() => {
    if (!open) return;
    // StrictMode re-runs this effect at once: reuse the entry instead of pushing a second one.
    if (pendingBack !== null) { clearTimeout(pendingBack); pendingBack = null; }
    else window.history.pushState({ ...(window.history.state ?? {}), sheet: true }, '');
    let fromPop = false;
    const onPop = () => { fromPop = true; closeRef.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!fromPop && window.history.state?.sheet === true) {
        pendingBack = setTimeout(() => { pendingBack = null; window.history.back(); }, 0);
      }
    };
  }, [open]);

  // Escape, scroll lock, focus in and back out.
  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      (initialFocus === 'field' ? panel.querySelector<HTMLElement>('input, textarea, select') ?? panel : panel).focus();
    }
    // Capture phase + stopPropagation: Escape closes only the top layer (a Sheet over a Modal leaves the Modal open).
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const opener = openerRef.current;
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
      if (opener && opener.isConnected) opener.focus();
      else (document.querySelector<HTMLElement>('h1') ?? document.body).focus?.();
    };
  }, [open, mounted, initialFocus]);

  const trap = useCallback((e: KeyboardEvent) => {
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
  }, []);

  // ── Drag down to close (phone only; the handle and title row are the grip) ──
  const isPhone = () => window.matchMedia('(max-width: 1023px)').matches;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setDrag = (dy: number, transition: string) => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transition = transition;
    panel.style.transform = dy ? `translateY(${dy}px)` : '';
    if (backdropRef.current) {
      backdropRef.current.style.transition = transition.replace('transform', 'opacity');
      backdropRef.current.style.opacity = String(Math.max(0, 1 - dy / panel.offsetHeight));
    }
  };
  function onGripDown(e: ReactPointerEvent<HTMLDivElement>) {
    // One finger only; buttons in the title row keep their own tap.
    if (drag.current || !entered || closing || !isPhone() || (e.target as HTMLElement).closest('button')) return;
    drag.current = { id: e.pointerId, startY: e.clientY, startT: performance.now(), dy: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  }
  function onGripMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const raw = e.clientY - d.startY;
    // Upward pull gets friction instead of a hard stop.
    d.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
    setDrag(d.dy, 'none');
  }
  function onGripUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const panel = panelRef.current;
    if (!panel) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.startT);
    const ms = reduced() ? 0 : 200;
    if (d.dy > panel.offsetHeight * 0.25 || (d.dy > 10 && velocity > 0.11)) {
      // A flick is enough. Slide out from where the finger let go, then close.
      dismissed.current = true;
      setDrag(panel.offsetHeight, ms ? `transform ${ms}ms var(--ease-drawer)` : 'none');
      setTimeout(() => closeRef.current(), ms);
    } else {
      setDrag(0, ms ? `transform ${ms}ms var(--ease-out)` : 'none');
    }
  }

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:justify-end">
      <div ref={backdropRef} className={`absolute inset-0 bg-black/50 ${closing ? 'backdrop-out' : entered ? '' : 'backdrop-in'}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={trap}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return; // an animation inside the sheet
          if (closing) { setMounted(false); setClosing(false); } else setEntered(true);
        }}
        className={`relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl border-t outline-none lg:h-full lg:max-h-none lg:max-w-[440px] lg:rounded-none lg:border-l lg:border-t-0 ${closing ? 'sheet-panel-out' : entered ? '' : 'sheet-panel-in'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
      >
        <div
          className="touch-none select-none lg:touch-auto"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
        >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full lg:hidden" style={{ background: 'var(--border-strong)' }} aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h2>
            {subtitle && <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-2)' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
