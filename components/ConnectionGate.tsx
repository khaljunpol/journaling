"use client";

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export default function ConnectionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
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

    // The connected spreadsheet lives in the session JWT (durable, no server store).
    if (!session?.spreadsheetId) {
      setAllowed(false);
      router.replace('/setup');
      return;
    }

    setAllowed(true);
  }, [pathname, router, skip, status, session?.spreadsheetId]);

  return allowed ? <>{children}</> : null;
}
