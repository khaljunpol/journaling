// Productive / Rest / Sleep split for the Trends > Time tab. Moved here from overview/derive.ts
// when the Overview dropped its groups; only TimeTrackerView uses it now.

const PRODUCTIVE = ['work', 'hobbies / projects', 'exercise / sports', 'chores', 'travel', 'content'];
const REST = ['relaxation / leisure', 'friends', 'wife', 'party', 'brain rot / misc'];

/** Weekly Productive / Rest / Sleep hours (one entry = one hour), by category name. */
export function timeBalance(
  entries: Array<{ category: number | string }>,
  cats: Array<{ id: string; name: string }>,
): { productive: number; rest: number; sleep: number } {
  const idsFor = (names: string[]) =>
    new Set(names.map((n) => cats.find((c) => c.name.toLowerCase() === n)?.id).filter((x): x is string => x !== undefined).map(String));
  const prod = idsFor(PRODUCTIVE);
  const rest = idsFor(REST);
  const sleepId = cats.find((c) => c.name.toLowerCase() === 'sleep')?.id;
  return {
    productive: entries.filter((t) => prod.has(String(t.category))).length,
    rest: entries.filter((t) => rest.has(String(t.category))).length,
    sleep: sleepId === undefined ? 0 : entries.filter((t) => String(t.category) === String(sleepId)).length,
  };
}
