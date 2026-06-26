"use client";

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export default function ConnectionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const [allowed, setAllowed] = useState(false);

  const skip =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/setup') ||
    pathname?.startsWith('/old-page');

  useEffect(() => {
    if (skip) {
      setAllowed(true);
      return;
    }
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setAllowed(false);
      router.replace('/login');
      return;
    }

    let cancelled = false;
    setAllowed(false);
    fetch('/api/connection')
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 403) {
          router.replace('/setup');
          return;
        }
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          setAllowed(true);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data?.reconnectRequired) {
          router.replace('/setup');
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) setAllowed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, skip, status]);

  return allowed ? <>{children}</> : null;
}
