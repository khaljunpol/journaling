import { auth, allowedEmails } from '@/lib/auth';
import { decideAccess } from '@/lib/accessRule';
import { isDemo } from '@/lib/demo';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

export default auth((req: NextRequest & { auth: Session | null }) => {
  const access = decideAccess({
    pathname: req.nextUrl.pathname,
    email: req.auth?.user?.email ?? null,
    allowed: allowedEmails,
    demo: isDemo(),
  });

  switch (access) {
    case 'to-login':
      return NextResponse.redirect(new URL('/login', req.url));
    case 'to-denied':
      return NextResponse.redirect(new URL('/login?error=AccessDenied', req.url));
    case 'to-home':
      return NextResponse.redirect(new URL('/', req.url));
    case 'json-401':
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    case 'json-403':
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    default:
      return NextResponse.next();
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
