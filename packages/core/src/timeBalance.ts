// Time groups: every hour category belongs to one of seven groups (TimeCategories column E). Blank = guessed from the name.
// The groups match the habit areas where they can, so hours and habits tell one story. Pure, no imports.

export type TimeGroup = 'sleep' | 'work' | 'people' | 'rest' | 'body' | 'mind' | 'admin';
/** What the sheet stores: a group, or "none" to keep a category out of every group. */
export type StoredGroup = TimeGroup | 'none';

export const GROUPS: Array<{ id: TimeGroup; label: string; color: string }> = [
  { id: 'sleep', label: 'Sleep', color: '#6A5FC4' },
  { id: 'work', label: 'Work', color: '#38BDF8' },
  { id: 'people', label: 'People', color: '#FB7185' },
  { id: 'rest', label: 'Rest', color: '#34D399' },
  { id: 'body', label: 'Body', color: '#F59E0B' },
  { id: 'mind', label: 'Mind', color: '#E879F9' },
  { id: 'admin', label: 'Life admin', color: '#7A84A0' },
];

/** First match wins, so the more specific groups come first. */
const GUESS: Array<[TimeGroup, RegExp]> = [
  ['sleep', /\b(sleep\w*|nap\w*)\b/],
  ['people', /\b(wife|husband|partner|friends?|family|party|parties|date|social|kids?|children)\b/],
  ['body', /\b(exercise|sports?|gym|run\w*|climb\w*|walk\w*|yoga|swim\w*|bike|cycling)\b/],
  ['mind', /\b(hobb\w*|projects?|class(es)?|study\w*|learn\w*|course\w*|music|writ\w*|lesson\w*)\b/],
  ['work', /\b(work\w*|freelance|job|office|meetings?|productive)\b/],
  ['rest', /\b(relax\w*|leisure|tv|games?|gaming|rest)\b/],
  ['admin', /\b(chores?|travel\w*|errands?|commut\w*|admin|brain rot|misc|clean\w*|shopping)\b/],
];

/** A stored group, cleaned. The old "productive" reads as work. Anything unknown gives undefined (then the name decides). */
export function parseGroup(v: unknown): StoredGroup | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'productive') return 'work';
  return s === 'none' || GROUPS.some((g) => g.id === s) ? (s as StoredGroup) : undefined;
}

/** The category's group: the saved one, else a guess from the name. Null = in no group. */
export function groupOf(cat: { name: string; group?: StoredGroup }): TimeGroup | null {
  if (cat.group) return cat.group === 'none' ? null : cat.group;
  const n = cat.name.toLowerCase();
  for (const [group, re] of GUESS) if (re.test(n)) return group;
  return null;
}

/** Hours per group (one entry = one hour). */
export function timeBalance(
  entries: Array<{ category: number | string }>,
  cats: Array<{ id: string; name: string; group?: StoredGroup }>,
): Record<TimeGroup, number> {
  const byId = new Map(cats.map((c) => [String(c.id), groupOf(c)]));
  const out: Record<TimeGroup, number> = { sleep: 0, work: 0, people: 0, rest: 0, body: 0, mind: 0, admin: 0 };
  for (const e of entries) {
    const g = byId.get(String(e.category));
    if (g) out[g] += 1;
  }
  return out;
}
