import { NextResponse } from 'next/server';

// Auth is now handled by NextAuth at /api/auth/[...nextauth]
export async function POST() {
  return NextResponse.json({ error: 'Use /api/auth/signin' }, { status: 410 });
}
