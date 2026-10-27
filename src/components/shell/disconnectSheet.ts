'use client';

/** Forget the connected sheet (server cookie) and go to setup. */
export async function disconnectSheet(go: (path: string) => void): Promise<void> {
  try {
    await fetch('/api/connection', { method: 'DELETE' });
  } catch { /* still go to setup; the next load asks the server again */ }
  go('/setup');
}
