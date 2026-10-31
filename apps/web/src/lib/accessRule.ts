// No imports: node --test loads this file directly.
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

export function decideAccess(input: { pathname: string; email: string | null; allowed: string[] }): Access {
  const { pathname, email, allowed } = input;
  if (isPublicPath(pathname)) return 'next';

  const isApi = pathname.startsWith('/api/');
  if (!email) {
    if (isApi) return 'json-401';
    return pathname === '/login' ? 'next' : 'to-login';
  }
  if (!isAllowed(email, allowed)) {
    if (isApi) return 'json-403';
    // /login must stay reachable here, or a denied user loops forever.
    return pathname === '/login' ? 'next' : 'to-denied';
  }
  return pathname === '/login' ? 'to-home' : 'next';
}
