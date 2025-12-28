import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

async function verify(token: string) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('Missing SESSION_SECRET');
    const key = new TextEncoder().encode(secret);
    return jwtVerify(token, key, { algorithms: ['HS256'] });
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/login') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.startsWith('/public')
    ) {
        return NextResponse.next();
    }

    const token = req.cookies.get('session')?.value;
    if (!token) {
        const url = new URL('/login', req.url);
        return NextResponse.redirect(url);
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
        const url = new URL('/login', req.url);
        return NextResponse.redirect(url);
    }
}

export const config = {
    matcher: ['/((?!api|_next|favicon.ico|public).*)'],
};
