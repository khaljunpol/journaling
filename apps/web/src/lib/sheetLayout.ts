// Every tab name and header row the app uses lives here. No imports, so tests can load it.

export const TABS = {
  activities: 'Activities',
  logs: 'Logs',
  highlights: 'Highlights',
  weights: 'Weights',
  moods: 'Moods',
  climbs: 'Climbs',
  climbGoals: 'ClimbGoals',
  hours: 'Hours',
  timeCategories: 'TimeCategories',
  sidequests: 'Sidequests',
  sidequestLogs: 'SidequestLogs',
  settings: 'Settings',
} as const;

export type TabKey = keyof typeof TABS;

export const HEADERS: Record<TabKey, string[]> = {
  activities: ['id', 'name', 'status'],
  logs: ['date', 'activityId', 'completed'],
  highlights: ['date', 'text'],
  weights: ['date', 'weight'],
  moods: ['date', 'score'],
  climbs: ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes'],
  climbGoals: ['id', 'year', 'type', 'grade', 'target'],
  hours: ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)],
  timeCategories: ['id', 'name', 'color', 'order', 'group'],
  sidequests: ['id', 'title', 'type', 'year', 'unit', 'target', 'milestones', 'description', 'createdAt', 'completedAt'],
  sidequestLogs: ['id', 'sidequestId', 'date', 'value', 'value2', 'note', 'milestoneIndex'],
  settings: ['key', 'value'],
};

/** A1 range with the tab name quoted; a single quote in the name is doubled. */
export function range(tab: string, cells: string): string {
  return `'${tab.replace(/'/g, "''")}'!${cells}`;
}

/** Data rows of a tab (header row skipped), as one A1 range. */
export function dataRange(tab: TabKey): string {
  const last = String.fromCharCode(64 + HEADERS[tab].length);
  return range(TABS[tab], `A2:${last}`);
}
