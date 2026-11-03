// Pure route data for the shell. No React, no icons: icon names are strings
// that the shell maps to lucide components.

export type NavId = 'today' | 'overview' | 'trends' | 'climbing' | 'progress' | 'world' | 'settings';
export type IconName = 'CalendarCheck' | 'LayoutGrid' | 'LineChart' | 'Mountain' | 'Trophy' | 'Sunrise' | 'Settings';

export type NavItem = { id: NavId; label: string; href: string; key: string; icon: IconName };

export const NAV: readonly NavItem[] = [
  { id: 'today', label: 'Today', href: '/quick', key: 'q', icon: 'CalendarCheck' },
  { id: 'overview', label: 'Overview', href: '/', key: 'o', icon: 'LayoutGrid' },
  { id: 'trends', label: 'Trends', href: '/trends', key: 'r', icon: 'LineChart' },
  { id: 'climbing', label: 'Climbing', href: '/climbing', key: 'c', icon: 'Mountain' },
  { id: 'progress', label: 'Progress', href: '/progress', key: 'p', icon: 'Trophy' },
  { id: 'world', label: 'World', href: '/world', key: 'w', icon: 'Sunrise' },
  { id: 'settings', label: 'Settings', href: '/settings', key: ',', icon: 'Settings' },
];

/** Overview link for phones: `?stay=1` stops `/` from jumping to Today. */
export const OVERVIEW_STAY = '/?stay=1';

/** Old pages that now live somewhere else. Used by next.config.ts. */
export const LEGACY_REDIRECTS: Array<{ source: string; destination: string }> = [
  { source: '/journal', destination: '/quick' },
  { source: '/mood', destination: '/trends?tab=mood' },
  { source: '/time', destination: '/trends?tab=time' },
  { source: '/sidequests', destination: '/progress' },
  { source: '/activities', destination: '/settings#activities' },
  { source: '/time-categories', destination: '/settings#time' },
  { source: '/climbing-log', destination: '/climbing?tab=log' },
  { source: '/climbing-goals', destination: '/climbing?tab=log' },
];

export const PHONE_MAX_WIDTH = 639;

/** On a phone-width screen `/` opens Today, unless the link said `?stay=1`. */
export function shouldOpenToday(width: number, search: string): boolean {
  if (width > PHONE_MAX_WIDTH) return false;
  return new URLSearchParams(search).get('stay') !== '1';
}

/** Which nav item a path belongs to (null for pages outside the nav). */
export function navIdForPath(pathname: string): NavId | null {
  if (pathname === '/') return 'overview';
  for (const item of NAV) {
    if (item.href === '/') continue;
    if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.id;
  }
  return null;
}
