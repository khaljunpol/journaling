// Only import-free files: node --test loads this file directly.
import { isDemoEmail } from './demo.ts';

export type Access = 'next' | 'to-login' | 'to-denied' | 'to-home' | 'json-401' | 'json-403';

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.webmanifest' ||
    // The route itself checks CRON_SECRET. Exact match only.
    pathname === '/api/reminder/run' ||
    // The route itself checks the device key. Exact match only: /api/device/keys needs a session.
    pathname === '/api/device' ||
    pathname.startsWith('/sw') ||
    pathname.startsWith('/icon')
  );
}

function isAllowed(email: string | null, allowed: string[]): boolean {
  const e = email?.trim().toLowerCase();
  return !!e && allowed.some((a) => a.trim().toLowerCase() === e);
}

export function decideAccess(input: { pathname: string; email: string | null; allowed: string[]; demo?: boolean }): Access {
  const { pathname, email, allowed, demo = false } = input;
  if (isPublicPath(pathname)) return 'next';
  // The demo has no sheet to connect.
  if (demo && pathname === '/setup') return 'to-home';

  const isApi = pathname.startsWith('/api/');
  if (!email) {
    if (isApi) return 'json-401';
    return pathname === '/login' ? 'next' : 'to-login';
  }
  const ok = demo ? isDemoEmail(email) : isAllowed(email, allowed);
  if (!ok) {
    if (isApi) return 'json-403';
    // /login must stay reachable here, or a denied user loops forever.
    return pathname === '/login' ? 'next' : 'to-denied';
  }
  return pathname === '/login' ? 'to-home' : 'next';
}
