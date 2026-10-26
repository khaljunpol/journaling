// Simple localStorage cache helpers for client components
// Store shape: { cachedAt: ISOString, data: any }

export type CacheEntry<T> = { cachedAt: string; data: T };

export function getCache<T = unknown>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed as CacheEntry<T>;
    }
    return null;
  } catch { /* localStorage unavailable in SSR or corrupt data */
    return null;
  }
}

export function setCache<T = unknown>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { cachedAt: new Date().toISOString(), data };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch { /* localStorage unavailable in SSR or quota exceeded */ }
}

// Cache-first pattern helper: apply cached immediately, then fetch fresh and update cache
export async function cacheFirst<T>(opts: {
  key: string;
  fetcher: () => Promise<T>;
  apply: (data: T, source: 'cache' | 'fresh', cachedAt?: string) => void;
}): Promise<void> {
  const { key, fetcher, apply } = opts;
  const cached = getCache<T>(key);
  if (cached) {
    try { apply(cached.data, 'cache', cached.cachedAt); } catch { /* apply callback may throw if component unmounted */ }
  }
  try {
    const fresh = await fetcher();
    try { setCache<T>(key, fresh); } catch { /* localStorage unavailable or quota exceeded */ }
    try { apply(fresh, 'fresh'); } catch { /* apply callback may throw if component unmounted */ }
  } catch {
    // swallow; caller can decide how to handle loading state
  }
}

// Remove every localStorage key except `keep`. Used on sign-out so the next person
// on this browser sees none of the previous user's cached data. Never throws.
export function clearLocalCache(keep: string[] = ['theme']): void {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage) return;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== null && !keep.includes(k)) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
  } catch { /* localStorage unavailable */ }
}
