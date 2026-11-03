// Settings and request bodies for the game routes. Pure: a bad value becomes a safe default, never a throw.
import { parseBadges } from '@journaling/core/badges';
import { parseHabitTemplate } from '@journaling/core/quickDay';
import type { PlantRecord } from '@journaling/core/world';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const json = (s: string | undefined): unknown => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

export type GameSettings = {
  templates: { weekday: string[] | null; weekend: string[] | null };
  /** Last locked date, or null before the first lock. */
  lockedTo: string | null;
  /** The user tapped "Count my history". Until then nothing is written. */
  imported: boolean;
  badges: Record<string, string>;
};

export function gameSettings(s: Record<string, string>): GameSettings {
  const cursor = (s.scoresLockedTo ?? '').trim();
  return {
    templates: { weekday: parseHabitTemplate(json(s.habitTemplateWeekday)), weekend: parseHabitTemplate(json(s.habitTemplateWeekend)) },
    lockedTo: ISO.test(cursor) ? cursor : null,
    imported: s.gameImported === '1',
    badges: parseBadges(s.badges),
  };
}

/** Body of POST /api/game/fill: up to 31 YYYY-MM-DD dates, else null. */
export function parseFillDates(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 31) return null;
  return v.every((d) => typeof d === 'string' && ISO.test(d)) ? (v as string[]) : null;
}

const PLANT_KINDS = new Set(['tree', 'sun', 'bamboo']);

/** Settings `worldPlants`: { [habitId]: { slot, kind, name } }. Bad entries are dropped, junk gives {}. */
export function parseWorldPlants(v: string | undefined): Record<string, PlantRecord> {
  const o = json(v);
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out: Record<string, PlantRecord> = {};
  for (const [id, r] of Object.entries(o as Record<string, unknown>)) {
    const x = r as Partial<PlantRecord> | null;
    if (!x || !Number.isInteger(x.slot) || (x.slot as number) < 0 || !PLANT_KINDS.has(String(x.kind)) || typeof x.name !== 'string') continue;
    out[id] = { slot: x.slot as number, kind: x.kind as PlantRecord['kind'], name: x.name };
  }
  return out;
}
