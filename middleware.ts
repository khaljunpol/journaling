import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session;

  // Always allow auth routes and static assets
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/sw') ||
    pathname.startsWith('/icon')
  ) {
    return NextResponse.next();
  }

  // Not logged in
  if (!isLoggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (pathname === '/login') return NextResponse.next();
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Logged in but on login page → redirect home
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Logged in but setup not complete → redirect to /setup
  if (!session.spreadsheetId && pathname !== '/setup' && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  // /api/ routes: require setup to be done (except /api/setup itself)
  if (pathname.startsWith('/api/') && !session.spreadsheetId && pathname !== '/api/setup') {
    return NextResponse.json({ error: 'Setup required' }, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
