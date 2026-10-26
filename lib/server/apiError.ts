/**
 * Safe error responses for the API routes.
 *
 * Google's Sheets errors are chatty: they quote the range they could not parse
 * (which names tabs and columns), name the service account, and carry the
 * spreadsheet id. Nothing derived from the exception reaches the browser. The
 * exception is logged server-side, redacted.
 *
 * Copied from listing-tracker/src/lib/server/api-error.ts and adapted for
 * robot (service account) mode. Free of any `next/server` import so it can be
 * tested directly.
 */

export type ApiErrorKind =
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'rate_limit'
  | 'upstream'
  | 'unknown';

/** Strip anything that identifies the sheet, its structure, or the bot. */
export function redact(text: string): string {
  return text
    // service accounts and any other address
    .replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, '[account]')
    // 'Tab name'!A1:X400 names internal tabs and column layout
    .replace(/(?:'[^']*'|[^\s:'"]+)!\$?[A-Z]+\$?\d*(?::\$?[A-Z]+\$?\d*)?/g, '[range]')
    // spreadsheet ids, tokens, anything long and opaque
    .replace(/[A-Za-z0-9_-]{25,}/g, '[id]');
}

function haystack(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  const e = err as Record<string, unknown>;
  const parts = [
    typeof e.message === 'string' ? e.message : '',
    typeof e.code === 'string' || typeof e.code === 'number' ? String(e.code) : '',
    typeof e.status === 'number' ? String(e.status) : '',
    typeof (e.response as Record<string, unknown> | undefined)?.status === 'number'
      ? String((e.response as Record<string, unknown>).status)
      : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export function classifyApiError(err: unknown): ApiErrorKind {
  const s = haystack(err).toLowerCase();
  if (!s) return 'unknown';

  if (/sign in again|insufficient authentication|invalid_grant|invalid credentials|unauthenticated|\b401\b/.test(s)) return 'auth';
  if (/does not have permission|permission_denied|forbidden|\b403\b/.test(s)) return 'permission';
  // "Unable to parse range" is what Sheets says when a tab was renamed or deleted.
  if (/unable to parse range|requested entity was not found|not found|\b404\b/.test(s)) return 'not_found';
  if (/quota exceeded|rate.?limit|too many requests|\b429\b/.test(s)) return 'rate_limit';
  if (/etimedout|econnreset|econnrefused|enotfound|eai_again|socket hang up|network|\b50[0234]\b/.test(s)) return 'upstream';

  return 'unknown';
}

const MESSAGES: Record<ApiErrorKind, string> = {
  auth: 'The app could not sign in to Google Sheets. Try again later.',
  permission: "No access to the spreadsheet. Open Setup and share the sheet with the app's service account as an Editor.",
  not_found: 'Could not find that sheet or tab. If you renamed or deleted a tab in the spreadsheet, restore the original name, then reload.',
  rate_limit: 'Google is rate-limiting the spreadsheet right now. Wait about a minute and try again.',
  upstream: 'Could not reach Google Sheets. Check your connection and try again in a moment.',
  unknown: 'Something failed while talking to your spreadsheet. Your data has not been changed. Try again, and reload if it keeps happening.',
};

export function safeMessage(kind: ApiErrorKind): string {
  return MESSAGES[kind];
}

function statusFor(kind: ApiErrorKind): number {
  switch (kind) {
    case 'auth': return 401;
    case 'permission': return 403;
    case 'not_found': return 404;
    case 'rate_limit': return 429;
    case 'upstream': return 502;
    default: return 500;
  }
}

/**
 * Log the real error (redacted), return something safe to render.
 * `context` names the route and method so the log is greppable.
 */
export function apiErrorBody(err: unknown, context: string): { error: string } {
  const kind = classifyApiError(err);
  console.error(`[${context}] ${kind}:`, redact(err instanceof Error ? (err.stack ?? err.message) : String(err)));
  return { error: safeMessage(kind) };
}

export function apiErrorStatus(err: unknown): number {
  return statusFor(classifyApiError(err));
}
