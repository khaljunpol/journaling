// Plans the one-time rename of `<Base>_<account>` tabs to plain `<Base>` tabs.
// No imports, so tests can load it. BASES must match TABS in sheetLayout.ts (a test checks this).

export const BASES = [
  'Activities', 'Logs', 'Highlights', 'Weights', 'Moods', 'Climbs',
  'ClimbGoals', 'Hours', 'TimeCategories', 'Sidequests', 'SidequestLogs',
  'Settings', 'DayLogs', 'DayScores',
] as const;

function split(title: string): { base: string; account: string } | null {
  const i = title.indexOf('_');
  if (i <= 0 || i === title.length - 1) return null;
  const base = title.slice(0, i);
  if (!(BASES as readonly string[]).includes(base)) return null;
  return { base, account: title.slice(i + 1) };
}

export function findAccountSets(titles: string[]): Array<{ account: string; tabs: string[] }> {
  const sets = new Map<string, string[]>();
  for (const title of titles) {
    const parts = split(title);
    if (!parts) continue;
    const tabs = sets.get(parts.account) ?? [];
    tabs.push(title);
    sets.set(parts.account, tabs);
  }
  return [...sets].map(([account, tabs]) => ({ account, tabs }));
}

export function planTabRename(titles: string[], account: string): {
  renames: Array<{ from: string; to: string }>;
  skipped: Array<{ from: string; reason: 'plain-exists' }>;
} {
  const renames: Array<{ from: string; to: string }> = [];
  const skipped: Array<{ from: string; reason: 'plain-exists' }> = [];
  for (const title of titles) {
    const parts = split(title);
    if (!parts || parts.account !== account) continue;
    if (titles.includes(parts.base)) skipped.push({ from: title, reason: 'plain-exists' });
    else renames.push({ from: title, to: parts.base });
  }
  return { renames, skipped };
}
