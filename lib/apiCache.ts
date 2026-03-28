/**
 * Factory for creating in-memory TTL caches used by API route handlers
 * to reduce Google Sheets read requests.
 */
export function createApiCache<T = unknown>(ttlMs = 60_000) {
  const cache = new Map<string, { ts: number; data: T }>();

  return {
    get(key: string): T | undefined {
      const hit = cache.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.ts > ttlMs) {
        cache.delete(key);
        return undefined;
      }
      return hit.data;
    },

    set(key: string, data: T): void {
      cache.set(key, { ts: Date.now(), data });
    },

    invalidate(): void {
      cache.clear();
    },
  };
}
