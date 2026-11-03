"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SIZE_MAP = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-4xl',
} as const;

export default function Modal({
  open,
  onClose,
  children,
  size = 'md',
  mobileSheet = true,
  title,
  hideClose = false,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  mobileSheet?: boolean;
  title?: string;
  hideClose?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const scrollY = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Scroll lock (iOS-safe: position fixed + top offset)
  useEffect(() => {
    if (!open || closing) return;
    scrollY.current = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.classList.add('scroll-lock');
    return () => {
      body.classList.remove('scroll-lock');
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      window.scrollTo(0, scrollY.current);
    };
  }, [open, closing]);

  // ESC key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); handleClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function handleClose() {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 150);
  }

  if (!mounted || !open) return null;

  const sizeClass = SIZE_MAP[size];
  const rounding = mobileSheet ? 'rounded-t-2xl sm:rounded-2xl' : 'rounded-2xl';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`}
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Content wrapper */}
      <div
        className={`fixed inset-0 z-50 flex ${mobileSheet ? 'items-end' : 'items-center'} sm:items-center justify-center pointer-events-none`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <div
          className={`pointer-events-auto w-full ${sizeClass} ${rounding} max-h-[90dvh] overflow-y-auto p-5 ${closing ? 'modal-out' : 'modal-in'} ${className}`}
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            border: '1px solid var(--border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
              <button
                onClick={handleClose}
                className="btn-outline px-2 py-1 text-xs"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}
          {!title && !hideClose && (
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 btn-outline px-2 py-1 text-xs"
              aria-label="Close"
            >
              ✕
            </button>
          )}
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
