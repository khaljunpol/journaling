// No imports: node --test loads this file directly.
export const DEMO_DOMAIN = 'demo.invalid';

/**
 * True when the app runs as a public demo (DEMO_MODE=1). Read at call time.
 * Pages are prerendered, so DEMO_MODE must be set at build time and at run time.
 */
export function isDemo(): boolean {
  return process.env.DEMO_MODE === '1';
}

/** True for a demo visitor email: demo-<id>@demo.invalid. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return demoSheetId(email ?? '') !== null;
}

/** The demo sheet id for a demo email (demo-<id>), or null for any other email. */
export function demoSheetId(email: string): string | null {
  const e = email.trim().toLowerCase();
  const suffix = `@${DEMO_DOMAIN}`;
  if (!e.endsWith(suffix)) return null;
  const local = e.slice(0, -suffix.length);
  return /^demo-[a-z0-9-]+$/.test(local) ? local : null;
}
