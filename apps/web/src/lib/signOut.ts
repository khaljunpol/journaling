'use client';

import { signOut } from 'next-auth/react';
import { clearLocalCache } from '@/lib/cache';
import { clearQuick } from '@/lib/quickStore';

/**
 * Sign out and leave nothing behind for the next person on this browser:
 * the sheet cookie (server) and cached data (this device). Adapted from
 * listing-tracker sign-out.ts. A failed clear never blocks signing out.
 */
export async function signOutClean(callbackUrl = '/login'): Promise<void> {
  try {
    await fetch('/api/connection', { method: 'DELETE' });
  } catch { /* signing out still clears the session */ }
  clearLocalCache();
  clearQuick();
  await signOut({ callbackUrl });
}
