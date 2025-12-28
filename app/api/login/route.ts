import { NextResponse } from 'next/server';
import { issueSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = String(body?.password || '');
    const adminPass = process.env.ADMIN_PASSWORD || '';
    if (!adminPass) return NextResponse.json({ error: 'ADMIN_PASSWORD not set' }, { status: 503 });
    // Basic rate limiting using a cookie tracking attempts within 10 minutes
    const url = new URL(req.url);
    const cookieHeader = req.headers.get('cookie') || '';
    const attemptsMatch = cookieHeader.match(/lr=(\d+)-(\d+)/); // lr=attempts-timestamp
    let attempts = 0;
    let ts = 0;
    if (attemptsMatch) {
      attempts = Number(attemptsMatch[1] || 0);
      ts = Number(attemptsMatch[2] || 0);
    }
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    if (!ts || now - ts > windowMs) {
      attempts = 0; ts = now;
    }
    if (attempts >= 5) {
      const res = NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
      res.cookies.set('lr', `${attempts}-${ts}`, { path: '/', maxAge: 600 });
      return res;
    }
    if (!password || password !== adminPass) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });

    const token = await issueSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set('session', token, {
      httpOnly: true,
      secure: !!process.env.VERCEL,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    // Reset rate limiting cookie on success
    res.cookies.set('lr', `0-${Date.now()}`, { path: '/', maxAge: 600 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
