// Pure helpers for the 7 pm reminder. No imports, so tests can load it.

export function shouldRemind(input: {
  enabled: boolean;
  hasSubscription: boolean;
  status: { filled: number; total: number };
}): boolean {
  return input.enabled && input.hasSubscription && input.status.filled < input.status.total;
}

/** True only for `Bearer <secret>`. Always false when the secret is unset or empty. */
export function checkCronAuth(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.push.services.mozilla.com', '.notify.windows.com'];

/** True only for https URLs on a known browser push service. Blocks look-alike hosts. */
export function isPushEndpoint(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return host === 'fcm.googleapis.com' || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
}
