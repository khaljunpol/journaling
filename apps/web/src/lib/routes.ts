// Pure route data for the shell. No React, no icons: icon names are strings
// that the shell maps to lucide components.

export type NavId = 'today' | 'home' | 'insights' | 'climbing' | 'you' | 'settings';
export type IconName = 'CalendarCheck' | 'LayoutGrid' | 'LineChart' | 'Mountain' | 'Trophy' | 'Settings';

export type NavItem = { id: NavId; label: string; href: string; key: string; icon: IconName };

/** Five pages, one job each: log (Today), this week (Home), what changes my days (Insights), climbing, game and goals (You). */
export const NAV: readonly NavItem[] = [
  { id: 'today', label: 'Today', href: '/quick', key: 'q', icon: 'CalendarCheck' },
  { id: 'home', label: 'Home', href: '/', key: 'o', icon: 'LayoutGrid' },
  { id: 'insights', label: 'Insights', href: '/insights', key: 'i', icon: 'LineChart' },
  { id: 'climbing', label: 'Climbing', href: '/climbing', key: 'c', icon: 'Mountain' },
  { id: 'you', label: 'You', href: '/you', key: 'y', icon: 'Trophy' },
  { id: 'settings', label: 'Settings', href: '/settings', key: ',', icon: 'Settings' },
];

/** Phone bottom tabs. Climbing opens from Home and Today; Settings from the header gear. */
export const PHONE_TABS: readonly NavId[] = ['today', 'home', 'insights', 'you'];

/** Old pages that now live somewhere else. Used by next.config.ts (query strings carry over). */
export const LEGACY_REDIRECTS: Array<{ source: string; destination: string }> = [
  { source: '/journal', destination: '/quick' },
  { source: '/mood', destination: '/insights' },
  { source: '/time', destination: '/insights?section=time' },
  { source: '/trends', destination: '/insights' },
  { source: '/progress', destination: '/you' },
  { source: '/sidequests', destination: '/you' },
  { source: '/activities', destination: '/settings#activities' },
  { source: '/time-categories', destination: '/settings#time' },
  { source: '/climbing-log', destination: '/climbing?tab=log' },
  { source: '/climbing-goals', destination: '/climbing?tab=log' },
];

export const PHONE_MAX_WIDTH = 639;

/** Which nav item a path belongs to (null for pages outside the nav). */
export function navIdForPath(pathname: string): NavId | null {
  if (pathname === '/') return 'home';
  if (pathname === '/world' || pathname.startsWith('/world/')) return 'you';
  for (const item of NAV) {
    if (item.href === '/') continue;
    if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.id;
  }
  return null;
}
