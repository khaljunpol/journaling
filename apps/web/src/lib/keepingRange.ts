import { TRACKING_START } from '@journaling/core/dayState';
import { keepingUp, type KeepingUp } from '@journaling/core/keepingUp';
import type { QuickPayload } from '@journaling/core/quickPayload';
import { addDaysISO } from '@journaling/core/quickWeek';

/** Keeping up shows 4 weeks back from a Monday, so 5 weeks covers it. */
export const KEEPING_DAYS = 35;

/** /api/quick reads at most this many days at once. */
export const QUICK_MAX_DAYS = 14;

/** Splits from..to (both included) into back-to-back ranges of at most `max` days. */
export function rangeChunks(from: string, to: string, max: number): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let start = from;
  while (start <= to) {
    const end = addDaysISO(start, max - 1);
    out.push([start, end < to ? end : to]);
    start = addDaysISO(end, 1);
  }
  return out;
}

type Part = Pick<QuickPayload, 'days' | 'stamps'>;

/** Keeping up from several /api/quick reads. Every logged day counts: it starts at the first one. */
export function keepingFromPayloads(today: string, payloads: Array<Part | null>): KeepingUp | null {
  const loaded = payloads.filter((p): p is Part => !!p?.days);
  if (!loaded.length) return null;
  const has = new Set<string>();
  const stamps = loaded.flatMap((p) => p.stamps ?? []);
  for (const p of loaded) {
    for (const d of Object.values(p.days)) {
      if (d.mood !== null) has.add(`${d.date}|mood`);
      if (d.logs.length) has.add(`${d.date}|habits`);
      if (d.hours.some((h) => h !== null)) has.add(`${d.date}|hours`);
      if (d.weight !== null) has.add(`${d.date}|weight`);
    }
  }
  for (const s of stamps) has.add(`${s.date}|${s.kind}`);
  let first: string = TRACKING_START;
  for (const k of has) if (k.slice(0, 10) < first) first = k.slice(0, 10);
  return keepingUp({ today, stamps, hasPart: (date, kind) => has.has(`${date}|${kind}`), start: first });
}
