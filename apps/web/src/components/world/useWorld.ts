'use client';

import { useEffect, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import type { World } from '@journaling/core/world';

// v2 shape: a cached v1 world must never be read.
const KEY = 'world:v2';

/** GET /api/world, the cached copy first (read after mount, so the first render matches the server). */
export function useWorld(): { world: World | null; failed: boolean } {
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const cached = getCache<World>(KEY)?.data;
    if (Array.isArray(cached?.plants)) setWorld(cached as World);
    fetch('/api/world')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('read failed'))))
      .then((w: World) => {
        if (cancelled || !Array.isArray(w?.plants)) return;
        setWorld(w);
        try { setCache(KEY, w); } catch { /* cache is optional */ }
      })
      .catch(() => { if (!cancelled && !cached) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  return { world, failed };
}

/** How many things existed at the last visit (a number only). */
export function seenCount(): number {
  try { return Number(localStorage.getItem('world:seen')) || 0; } catch { return 0; }
}
export function markSeen(n: number): void {
  try { localStorage.setItem('world:seen', String(n)); } catch { /* optional */ }
}
