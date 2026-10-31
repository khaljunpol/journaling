// Pure helpers for the "Fill N missing" card stack. No imports, so tests can load it.

export const SLIDE_MS = 200;

/** Move to the next card. finished is true once every card was answered or skipped. */
export function nextStep(index: number, total: number): { index: number; finished: boolean } {
  const next = Math.min(Math.max(index, 0) + 1, total);
  return { index: next, finished: next >= total };
}

/** Cards still to go, counting the one on screen. */
export function cardsLeft(index: number, total: number): number {
  return Math.max(total - Math.max(index, 0), 0);
}

export type DotState = 'done' | 'current' | 'todo';

export function dotState(dot: number, index: number): DotState {
  if (dot < index) return 'done';
  return dot === index ? 'current' : 'todo';
}

/** Taps during a slide are ignored, so fast taps never skip a card twice. */
export function canAdvance(now: number, lockedUntil: number): boolean {
  return now >= lockedUntil;
}
