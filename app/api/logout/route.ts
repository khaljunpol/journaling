import { NextResponse } from 'next/server';

// Auth is now handled by NextAuth at /api/auth/signout
export async function POST() {
  return NextResponse.json({ error: 'Use /api/auth/signout' }, { status: 410 });
}
