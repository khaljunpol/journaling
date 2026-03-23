import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

async function verify(token: string) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('Missing SESSION_SECRET');
    const key = new TextEncoder().encode(secret);
    return jwtVerify(token, key, { algorithms: ['HS256'] });
}

// Public routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/login', '/api/logout'];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow static assets and public auth endpoints without a session
    if (
        PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.startsWith('/public')
    ) {
        return NextResponse.next();
    }

    const token = req.cookies.get('session')?.value;
    if (!token) {
        // For API routes return 401 JSON; for pages redirect to login
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
        const { payload } = await verify(token);
        // Sliding refresh: if less than 2 days remaining, issue a new token
        const exp = (payload as any).exp ? Number((payload as any).exp) * 1000 : 0;
        const now = Date.now();
        const remainingMs = exp ? exp - now : 0;
        if (remainingMs > 0 && remainingMs < 2 * 24 * 60 * 60 * 1000) {
            const secret = process.env.SESSION_SECRET as string;
            const key = new TextEncoder().encode(secret);
            const fresh = await new SignJWT({ sub: 'admin' })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('7d')
                .sign(key);
            const res = NextResponse.next();
            res.cookies.set('session', fresh, {
                httpOnly: true,
                secure: !!process.env.VERCEL,
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
            });
            return res;
        }
        return NextResponse.next();
    } catch {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', req.url));
    }
}

export const config = {
    // Apply middleware to all routes except static Next.js internals
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
