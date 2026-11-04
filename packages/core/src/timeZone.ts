// The app's time zone decides where "today" starts and ends, on the server and in the browser.
// Set NEXT_PUBLIC_APP_TIME_ZONE to an IANA name (for example Europe/Paris) at build and run time. Default: UTC.

const formats = new Map<string, Intl.DateTimeFormat>();

function formatFor(zone: string): Intl.DateTimeFormat | null {
  const known = formats.get(zone);
  if (known) return known;
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formats.set(zone, f);
    return f;
  } catch {
    return null;
  }
}

/** The configured IANA zone, or UTC when it is unset or unknown. */
export function appTimeZone(): string {
  let zone: string | undefined;
  try {
    // Written out in full so Next.js can inline it into browser code.
    zone = process.env.NEXT_PUBLIC_APP_TIME_ZONE;
  } catch {
    zone = undefined;
  }
  return zone && formatFor(zone) ? zone : 'UTC';
}

/** The calendar date (YYYY-MM-DD) of an instant in the app's time zone. */
export function appDay(at: Date): string {
  return (formatFor(appTimeZone()) as Intl.DateTimeFormat).format(at);
}
