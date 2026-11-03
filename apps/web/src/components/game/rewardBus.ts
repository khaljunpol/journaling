'use client';

import { useEffect, useState } from 'react';

/** A Done on the habits card that earned something. Sent by the editor, shown by that day's tile. */
export type Reward = { date: string; points: number; perfect: boolean };
const EVENT = 'game:reward';

export function emitReward(r: Reward): void {
  if (typeof window === 'undefined' || (r.points <= 0 && !r.perfect)) return;
  window.dispatchEvent(new CustomEvent<Reward>(EVENT, { detail: r }));
}

/** The latest reward for `date`, cleared after `ms`. A new reward restarts the clock. */
export function useReward(date: string, ms = 900): (Reward & { key: number }) | null {
  const [r, setR] = useState<(Reward & { key: number }) | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const d = (e as CustomEvent<Reward>).detail;
      if (!d || d.date !== date) return;
      setR({ ...d, key: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setR(null), ms);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer); };
  }, [date, ms]);
  return r;
}

/** Confetti shows once per date per device. Returns true the first time only. */
export function firstPerfect(date: string): boolean {
  try {
    const key = `confetti:${date}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}
