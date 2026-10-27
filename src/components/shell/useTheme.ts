'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Reads the theme the head script set, and flips it (saved in localStorage). */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch { /* private mode: still switch for now */ }
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  return { theme, toggle };
}
