// The level widget's bar. No React Native imports, so tests can load it.
import { levelFor } from '@journaling/core/scoring';

/** How far into the current level, from 0 to 1. */
export function levelShare(g: { points: number }): number {
  const { into, cost } = levelFor(g.points);
  return cost > 0 ? Math.min(1, Math.max(0, into / cost)) : 0;
}
