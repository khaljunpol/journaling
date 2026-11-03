import type { GameState } from '@journaling/core/game';

/** The saved copy of the game holds numbers only: no habit names on a shared device. */
export type CachedGame = Pick<GameState, 'points' | 'level' | 'into' | 'toNext' | 'cost' | 'perfectDays' | 'today' | 'imported'>;

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** The saved numbers, or null when the copy is partial or from an older version. A partial copy would crash the page. */
export function cachedNumbers(v: unknown): CachedGame | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Record<string, unknown>;
  const today = g.today as Record<string, unknown> | null | undefined;
  if (!['points', 'level', 'into', 'toNext', 'cost', 'perfectDays'].every((k) => num(g[k]))) return null;
  if (!today || typeof today !== 'object' || !num(today.done) || !num(today.total)) return null;
  return g as unknown as CachedGame;
}
