// Habit categories. Same pattern as timeBalance.ts: a saved value wins, blank is guessed from the name.
// Each habit carries its category (Activities column D). Relative imports only.
import { doneHabits, habitIcon, type HabitIcon } from './habitIcons.ts';

export type HabitCategory = 'move' | 'wellbeing' | 'mind' | 'people' | 'bad' | 'other';

export const CATEGORIES: Array<{ id: HabitCategory; label: string; color: string }> = [
  { id: 'move', label: 'Body', color: 'var(--accent)' },
  { id: 'wellbeing', label: 'Well-being', color: '#34D399' },
  { id: 'mind', label: 'Mind', color: '#38BDF8' },
  { id: 'people', label: 'People', color: '#FB7185' },
  { id: 'bad', label: 'Bad habits', color: '#7A84A0' },
  { id: 'other', label: 'Other', color: 'var(--border-strong)' },
];

const BAD_WORDS = /\b(doom\s?scroll\w*|scroll\w*|junk|sweets?)\b/;
const FROM_ICON: Record<HabitIcon, HabitCategory> = {
  gym: 'move', hiit: 'move', bodyweight: 'move', racket: 'move', climb: 'move', run: 'move', swim: 'move', bike: 'move',
  yoga: 'wellbeing', meditate: 'wellbeing', water: 'wellbeing', shake: 'wellbeing', pill: 'wellbeing',
  read: 'mind', write: 'mind', music: 'mind',
  heart: 'people',
  beer: 'bad', wine: 'bad', smoke: 'bad',
  coffee: 'other', games: 'other',
};
const MAX_MAP = 500;

/** A stored category, cleaned. Anything unknown gives undefined (then the name decides). */
export function parseCategory(v: unknown): HabitCategory | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  return CATEGORIES.some((c) => c.id === s) ? (s as HabitCategory) : undefined;
}

/** The habit's category: the saved one, else a guess from the name. */
export function categoryOf(h: { name: string; category?: HabitCategory }): HabitCategory {
  if (h.category) return h.category;
  if (BAD_WORDS.test(h.name.toLowerCase())) return 'bad';
  const icon = habitIcon(h.name);
  return icon ? FROM_ICON[icon] : 'other';
}

/** Ids of the habits that count as wins: every habit except bad ones. */
export function goodIds(list: Array<{ id: string; name: string; category?: HabitCategory }>): Set<string> {
  return new Set(list.filter((h) => categoryOf(h) !== 'bad').map((h) => h.id));
}

/** Good and bad habits, each in their given order. */
export function splitHabits<T extends { name: string; category?: HabitCategory }>(list: T[]): { good: T[]; bad: T[] } {
  const bad = (h: T) => categoryOf(h) === 'bad';
  return { good: list.filter((h) => !bad(h)), bad: list.filter(bad) };
}

/** A map of habit id to category from a request. Anything invalid gives null. */
export function parseCategoryMap(v: unknown): Record<string, HabitCategory> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const entries = Object.entries(v);
  if (entries.length > MAX_MAP) return null;
  const out: Record<string, HabitCategory> = {};
  for (const [id, raw] of entries) {
    const c = parseCategory(raw);
    if (!c) return null;
    out[id] = c;
  }
  return out;
}

/** Habits done on a day for the Today tile. A bad habit stays off it: ticking one earns no chip. */
export function doneGoodHabits(
  logs: Array<{ activityId: string; completed: boolean }>,
  activities: Array<{ id: string; name: string; category?: HabitCategory }>,
  climbs: number,
) {
  return doneHabits(logs, splitHabits(activities).good, climbs);
}
