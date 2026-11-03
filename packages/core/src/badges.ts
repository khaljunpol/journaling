// Badges: earned once, kept for good (Settings key `badges`, JSON { id: date }). Pure. Relative imports only.

export const BADGES: Array<{ id: string; label: string }> = [
  { id: 'perfect-1', label: 'First perfect day' },
  { id: 'streak-7', label: '7-day streak' },
  { id: 'level-5', label: 'Level 5' },
  { id: 'perfect-10', label: '10 perfect days' },
  { id: 'rescued-10', label: '10 days rescued' },
  { id: 'streak-30', label: '30-day streak' },
  { id: 'level-10', label: 'Level 10' },
  { id: 'perfect-50', label: '50 perfect days' },
  { id: 'streak-100', label: '100-day streak' },
  { id: 'perfect-100', label: '100 perfect days' },
  { id: 'level-20', label: 'Level 20' },
];

/** Badge ids the numbers have reached. */
export function earnedBadges(s: { perfectDays: number; bestStreakDays: number; level: number; rescued: number }): string[] {
  const out: string[] = [];
  for (const n of [1, 10, 50, 100]) if (s.perfectDays >= n) out.push(`perfect-${n}`);
  for (const n of [7, 30, 100]) if (s.bestStreakDays >= n) out.push(`streak-${n}`);
  for (const n of [5, 10, 20]) if (s.level >= n) out.push(`level-${n}`);
  if (s.rescued >= 10) out.push('rescued-10');
  return out;
}

/** Stored badges plus newly earned ones, dated today. Never removes one, even if the habit behind it is gone. */
export function mergeBadges(stored: Record<string, string>, earned: string[], today: string): Record<string, string> {
  const out = { ...stored };
  for (const id of earned) if (!out[id]) out[id] = today;
  return out;
}

/** Stored badges from the sheet. Anything odd gives {}. */
export function parseBadges(v: unknown): Record<string, string> {
  try {
    const o = typeof v === 'string' ? JSON.parse(v) : v;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const keep = (e: [string, unknown]): e is [string, string] => BADGES.some((b) => b.id === e[0]) && typeof e[1] === 'string';
    return Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(keep));
  } catch {
    return {};
  }
}
