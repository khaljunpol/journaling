export type ClimbLogInput = {
  date: string;
  session: number;
  type: 'boulder' | 'rope';
  grade: string;
  attempts: number;
  location: string;
  notes: string;
};

export type ClimbLogMaxLen = { grade: number; location: number; notes: number };

export function parseClimbLogBody(
  body: unknown,
  maxLen: ClimbLogMaxLen,
): { ok: true; value: ClimbLogInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const date = String(b.date || '').slice(0, 10);
  const session = parseInt(String(b.session ?? '0'), 10) || 0;
  const type = (String(b.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
  const grade = String(b.grade || '').trim();
  const attempts = parseInt(String(b.attempts ?? '0'), 10) || 0;
  const location = String(b.location || '').trim();
  const notes = String(b.notes || '').trim();
  if (!date) return { ok: false, error: 'date required' };
  if (grade.length > maxLen.grade) return { ok: false, error: `grade must be ≤${maxLen.grade} characters` };
  if (location.length > maxLen.location) return { ok: false, error: `location must be ≤${maxLen.location} characters` };
  if (notes.length > maxLen.notes) return { ok: false, error: `notes must be ≤${maxLen.notes} characters` };
  return { ok: true, value: { date, session, type, grade, attempts, location, notes } };
}
