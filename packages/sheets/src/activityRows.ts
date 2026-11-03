// Pure helpers for Activities rows. No Google imports, so tests can load them.
import { parseCategory, type HabitCategory } from '@journaling/core/habitCategory';
import type { Activity } from '@journaling/core/types';

/** One sheet row as an activity. A short row or an unknown category gives no category. */
export function activityFromRow([id, name, status, category]: unknown[]): Activity {
  return {
    id: String(id).trim(),
    name: String(name || '').trim(),
    status: String(status || 'active').trim() || 'active',
    category: parseCategory(category),
  };
}

/** Which rows to write. `ids` is column A from row 2. Ids no longer in the sheet are skipped. */
export function categoryWrites(ids: unknown[][], map: Record<string, HabitCategory>): Array<{ row: number; category: HabitCategory }> {
  const out: Array<{ row: number; category: HabitCategory }> = [];
  ids.forEach((r, i) => {
    const category = map[String(r[0])];
    if (Object.hasOwn(map, String(r[0]))) out.push({ row: i + 2, category });
  });
  return out;
}
