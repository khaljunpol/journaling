'use client';

import { useEffect, useState } from 'react';

/**
 * True only the first time a view mounts in this browser tab (session key `key`), so coming back by link
 * does not replay the entrance. Client-only views only (dynamic, ssr: false). No storage means no entrance.
 */
export function useFirstVisit(key: string): boolean {
  const [first] = useState(() => {
    try {
      return window.sessionStorage.getItem(key) !== '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch { /* no storage: no entrance next time either */ }
  }, [key]);
  return first;
}
