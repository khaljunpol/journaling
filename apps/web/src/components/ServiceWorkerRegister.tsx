'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // Dev: the cache-first worker would keep old CSS chunks forever, so remove it and its caches.
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.filter((n) => n.startsWith('journal-')).map((n) => caches.delete(n)));
          }
        } catch { /* ignore */ }
      })();
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => { /* silently ignore unsupported environments */ });
  }, []);

  return null;
}
