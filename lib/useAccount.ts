"use client";

import { useEffect, useState } from 'react';
import { parseCookies } from '@/lib/apiHelpers';
import { DEFAULT_ACCOUNT } from '@/lib/constants';

function readAccount(): string {
  try {
    const fromCookie = parseCookies(document.cookie)['account'];
    if (fromCookie) return fromCookie;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    const fromStorage = localStorage.getItem('account');
    if (fromStorage) return fromStorage;
  }
  return DEFAULT_ACCOUNT;
}

/**
 * Shared hook for account state. Reads from cookie/localStorage
 * and listens for storage + account-change events.
 */
export function useAccount(): string {
  const [account, setAccount] = useState<string>(DEFAULT_ACCOUNT);

  useEffect(() => {
    setAccount(readAccount());

    const onStorage = () => setAccount(readAccount());
    const onAccountChange = () => setAccount(readAccount());

    window.addEventListener('storage', onStorage);
    window.addEventListener('account-change', onAccountChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('account-change', onAccountChange);
    };
  }, []);

  return account;
}
