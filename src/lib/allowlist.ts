// No imports: node --test loads this file directly.
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Fail closed: an empty list or a missing email never lets anyone in.
export function isEmailAllowed(email: string | null | undefined, allowed: string[]): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return allowed.some((a) => a.trim().toLowerCase() === normalized);
}
