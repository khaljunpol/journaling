import { BOULDER_GRADES, FRENCH_GRADES } from '@journaling/core/climbing';

export type ClimbType = 'boulder' | 'rope';
export type LogEntry = { id: string; date: string; session: number; type: ClimbType; grade: string; attempts: number; location?: string; notes?: string };

export const gradesFor = (t: ClimbType): string[] => (t === 'boulder' ? BOULDER_GRADES : FRENCH_GRADES);

/** 0 = flash, n = falls before the send. */
export const fallsLabel = (n: number): string => (n === 0 ? 'Flash' : `${n} ${n === 1 ? 'fall' : 'falls'}`);

/** "Mon 27 Oct", with the year when it is not this year. */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The fields the API stores for a log (everything but the id). */
export const logBody = (l: LogEntry) => ({ date: l.date.slice(0, 10), session: l.session, type: l.type, grade: l.grade, attempts: l.attempts, location: l.location ?? '', notes: l.notes ?? '' });
