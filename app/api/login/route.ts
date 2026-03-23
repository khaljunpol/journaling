import { NextResponse } from 'next/server';
import { issueSession } from '@/lib/auth';

// Server-side rate limiting: keyed by IP address
const rateLimitMap = new Map<string, { attempts: number; ts: number }>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.ts > WINDOW_MS) {
    rateLimitMap.set(ip, { attempts: 1, ts: now });
    return { allowed: true };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    return { allowed: false };
  }
  entry.attempts += 1;
  return { allowed: true };
}

function resetRateLimit(ip: string) {
  rateLimitMap.delete(ip);
}

export async function POST(req: Request) {
  try {
    const adminPass = process.env.ADMIN_PASSWORD || '';
    if (!adminPass) return NextResponse.json({ error: 'ADMIN_PASSWORD not set' }, { status: 503 });

    const ip = getClientIp(req);
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const password = String(body?.password || '');
    if (!password || password !== adminPass) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    resetRateLimit(ip);
    const token = await issueSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set('session', token, {
      httpOnly: true,
      secure: !!process.env.VERCEL,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    console.error('[login]', e);
    return NextResponse.json({ error: String(e?.message || 'Unknown error') }, { status: 500 });
  }
}
