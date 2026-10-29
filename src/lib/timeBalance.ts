// Productive / Rest / Sleep split for the Trends > Time tab. Pure, no imports.
// Each time category can carry a group (TimeCategories column E). Blank = guessed from the name.

export type TimeGroup = 'productive' | 'rest' | 'sleep';
/** What the sheet stores: a group, or "none" to keep a category out of every group. */
export type StoredGroup = TimeGroup | 'none';

const GUESS: Array<[TimeGroup, RegExp]> = [
  ['sleep', /\b(sleep\w*|nap\w*)\b/],
  ['productive', /\b(work\w*|freelance|projects?|hobb\w*|exercise|sports?|gym|chores?|productive|travel|study|studying|content|learn\w*)\b/],
  ['rest', /\b(relax\w*|leisure|friends?|partner|wife|husband|family|party|social|brain rot|games?|gaming|tv)\b/],
];

/** A stored group, cleaned. Anything unknown gives undefined (then the name decides). */
export function parseGroup(v: unknown): StoredGroup | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'productive' || s === 'rest' || s === 'sleep' || s === 'none' ? s : undefined;
}

/** The category's group: the saved one, else a guess from the name. Null = in no group. */
export function groupOf(cat: { name: string; group?: StoredGroup }): TimeGroup | null {
  if (cat.group) return cat.group === 'none' ? null : cat.group;
  const n = cat.name.toLowerCase();
  for (const [group, re] of GUESS) if (re.test(n)) return group;
  return null;
}

/** Weekly Productive / Rest / Sleep hours (one entry = one hour). */
export function timeBalance(
  entries: Array<{ category: number | string }>,
  cats: Array<{ id: string; name: string; group?: StoredGroup }>,
): { productive: number; rest: number; sleep: number } {
  const byId = new Map(cats.map((c) => [String(c.id), groupOf(c)]));
  const out = { productive: 0, rest: 0, sleep: 0 };
  for (const e of entries) {
    const g = byId.get(String(e.category));
    if (g) out[g] += 1;
  }
  return out;
}
