// The streak share card's data: only what may leave the device. Pure.
// Privacy rules: no mood, weight, date, email or sheet id; a bad habit never gets a card;
// a fixed file name; navigator.share gets the file only, no text, title or url.
import type { Streak } from '@journaling/core/streaks';

export const STREAK_FILE = 'streak-card.png';

export type StreakCardData = { title: string; streak: number; unit: 'days' | 'weeks'; best: number; level: number };

/** null for a bad habit. `hideName`: "My streak" instead of the habit name. */
export function streakCardData(s: Streak, level: number, hideName: boolean, bad: boolean): StreakCardData | null {
  if (bad) return null;
  return { title: hideName ? 'My streak' : s.name, streak: s.current, unit: s.unit, best: s.best, level };
}

/** What navigator.share gets: the file, nothing else. */
export function sharePayload(file: File): { files: File[] } {
  return { files: [file] };
}
