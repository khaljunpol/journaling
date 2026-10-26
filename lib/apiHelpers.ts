import { NextResponse } from 'next/server';
import { apiErrorBody, apiErrorStatus } from '@/lib/server/apiError';

/**
 * Returns a consistent JSON error response.
 */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Safely parse a cookie string (document.cookie) into a key→value map.
 * Use this instead of manual regex to avoid cookie-injection edge cases.
 */
export function parseCookies(cookieStr: string): Record<string, string> {
  return cookieStr.split(';').reduce<Record<string, string>>((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return acc;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
}

/** Max lengths for user-supplied string fields. */
export const MAX_LEN = {
  name: 255,
  category: 100,
  tags: 500,
  text: 2000,
  grade: 20,
  location: 255,
  notes: 1000,
  color: 50,
} as const;

/**
 * Safe JSON failure response: logs the redacted error server-side and returns
 * a fixed message. Use in every catch block instead of sending error text.
 */
export function apiFailure(err: unknown, context: string): NextResponse {
  return NextResponse.json(apiErrorBody(err, context), { status: apiErrorStatus(err) });
}
