'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import { shared } from '@/lib/shared';
import type { GameState } from '@journaling/core/game';
import { cachedNumbers, type CachedGame } from '@/lib/gameCache';

const KEY = 'game:state';

/** One GET /api/game for the whole page (chip, Progress), reused for 10 s. It reads every log, so it is not cheap. */
export const fetchGame = shared<GameState>(
  () => fetch('/api/game').then((r) => (r.ok ? r.json() : Promise.reject(new Error('read failed')))),
  10_000,
);
type Cached = CachedGame;

const numbersOnly = (g: GameState): Cached => ({
  points: g.points, level: g.level, into: g.into, toNext: g.toNext, cost: g.cost, perfectDays: g.perfectDays, today: g.today, imported: g.imported,
});

/** GET /api/game: the cached numbers first, then the fresh state (with streaks and badges). */
export function useGame(): {
  numbers: Cached | null;
  state: GameState | null;
  failed: boolean;
  reload: () => void;
  runImport: () => Promise<boolean>;
} {
  const [numbers, setNumbers] = useState<Cached | null>(() => cachedNumbers(getCache<unknown>(KEY)?.data));
  const [state, setState] = useState<GameState | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const take = useCallback((g: GameState) => {
    setState(g);
    setNumbers(numbersOnly(g));
    setFailed(false);
    try { setCache(KEY, numbersOnly(g)); } catch { /* cache is optional */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGame()
      .then((g) => { if (!cancelled && typeof g?.points === 'number') take(g); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [tick, take]);

  const runImport = useCallback(async () => {
    try {
      const r = await fetch('/api/game/import', { method: 'POST' });
      if (!r.ok) return false;
      take(await r.json());
      return true;
    } catch {
      return false;
    }
  }, [take]);

  return { numbers, state, failed, reload: () => setTick((t) => t + 1), runImport };
}
