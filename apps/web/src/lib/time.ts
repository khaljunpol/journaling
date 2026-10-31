import { HOUR_MAX } from './constants.ts';

export type ParsedTimeEntry =
  | { ok: true; entry: { hour: number; category: number } }
  | { ok: false; message: string };

export function parseTimeEntry(input: { hour: unknown; category: unknown }): ParsedTimeEntry {
  const hour = parseInt(String(input.hour ?? '-1'), 10);
  const category = parseInt(String(input.category ?? '-1'), 10);

  if (!Number.isInteger(hour) || hour < 0 || hour > HOUR_MAX) {
    return { ok: false, message: 'hour must be 0..23' };
  }
  if (!Number.isSafeInteger(category) || category < 0) {
    return { ok: false, message: 'category must be a non-negative integer' };
  }

  return { ok: true, entry: { hour, category } };
}
