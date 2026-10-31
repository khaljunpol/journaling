// Pure helper for the Today habits tile: which habits were done, and an icon when the name gives one. No imports.

export type HabitIcon =
  | 'gym' | 'hiit' | 'bodyweight' | 'racket' | 'climb' | 'run' | 'swim' | 'bike' | 'yoga'
  | 'beer' | 'wine' | 'smoke' | 'coffee' | 'water' | 'shake' | 'pill'
  | 'read' | 'meditate' | 'music' | 'write' | 'games' | 'heart';

const WORDS: Array<[HabitIcon, RegExp]> = [
  ['hiit', /\b(crossfit|hiit|wod)\b/],
  ['gym', /\b(gym|weights?|lifting|strength)\b/],
  ['bodyweight', /\b(push[ -]?ups?|pull[ -]?ups?|sit[ -]?ups?|press[ -]?ups?|calisthenics|plank)\b/],
  ['racket', /\b(squash|tennis|padel|badminton)\b/],
  ['climb', /\b(climb\w*|boulder\w*)\b/],
  ['run', /\b(run|running|jog\w*)\b/],
  ['swim', /\b(swim\w*)\b/],
  ['bike', /\b(bike|biking|cycl\w*)\b/],
  ['yoga', /\b(yoga|stretch\w*|mobility)\b/],
  ['beer', /\b(beers?|alcohol|drinks|drinking)\b/],
  ['wine', /\b(wine)\b/],
  ['smoke', /\b(smok\w*|cigarettes?|vape\w*)\b/],
  ['coffee', /\b(coffee|caffeine)\b/],
  ['water', /\b(water|hydrat\w*)\b/],
  ['shake', /\b(protein|shakes?)\b/],
  ['pill', /\b(creatine|vitamins?|supplements?|pills?|meds|magnesium|omega)\b/],
  ['read', /\b(read\w*|book)\b/],
  ['meditate', /\b(meditat\w*|breath\w*|mindful\w*)\b/],
  ['music', /\b(guitar|piano|music|sing\w*)\b/],
  ['write', /\b(journal\w*|writ\w*)\b/],
  ['games', /\b(games?|gaming)\b/],
  ['heart', /\b(date|dates|partner)\b/],
];

/** An icon for a habit, from its name. Null when nothing matches; the tile then shows the name only. */
export function habitIcon(name: string): HabitIcon | null {
  const n = name.toLowerCase();
  for (const [icon, re] of WORDS) if (re.test(n)) return icon;
  return null;
}

/** Habits done on a day, in habit order. Climb logs add "Climb" unless a climb habit is already ticked. */
export function doneHabits(
  logs: Array<{ activityId: string; completed: boolean }>,
  activities: Array<{ id: string; name: string }>,
  climbs: number,
): Array<{ id: string; label: string; icon: HabitIcon | null }> {
  const done = new Set(logs.filter((l) => l.completed).map((l) => l.activityId));
  const out = activities
    .filter((a) => done.has(a.id))
    .map((a) => ({ id: a.id, label: a.name, icon: habitIcon(a.name) }));
  if (climbs > 0 && !out.some((h) => h.icon === 'climb')) out.push({ id: 'climb-logs', label: 'Climb', icon: 'climb' });
  return out;
}
