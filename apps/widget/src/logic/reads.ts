// Which extra reads a habit tap pays for. No React Native imports, so tests can load it.

/** A widget that has read its numbers before is placed, so it reads again after a tap. Others cost nothing. */
export function readsAfterTap(s: { game: unknown; world: unknown }): Array<'game' | 'world'> {
  const out: Array<'game' | 'world'> = [];
  if (s.game) out.push('game');
  if (s.world) out.push('world');
  return out;
}
