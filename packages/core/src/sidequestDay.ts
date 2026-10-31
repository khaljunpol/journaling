// Pure helper for side quest logs. No imports, so tests can load it.

/**
 * Sheet row numbers (header = row 1) of the plain value logs for one quest on one day.
 * Milestone rows are left out. `rows` start at sheet row 2: id, sidequestId, date, value, value2, note, milestoneIndex.
 */
export function dayValueRows(rows: readonly (readonly unknown[])[], sidequestId: string, date: string): number[] {
  const out: number[] = [];
  rows.forEach((r, i) => {
    if (!r || !r[0]) return;
    if (String(r[1] ?? '').trim() !== sidequestId || String(r[2] ?? '').trim() !== date) return;
    if (String(r[6] ?? '').trim() !== '') return;
    out.push(i + 2);
  });
  return out;
}
