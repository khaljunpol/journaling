// Grade arrays
export const BOULDER_GRADES = Array.from({ length: 13 }, (_, i) => `V${i}`); // V0..V12
export const FRENCH_GRADES = [
  '5a', '5a+', '5b', '5b+', '5c', '5c+',
  '6a', '6a+', '6b', '6b+', '6c', '6c+',
  '7a', '7a+', '7b', '7b+', '7c', '7c+',
  '8a', '8a+', '8b', '8b+', '8c',
];

// Default grades for new log forms
export const DEFAULT_BOULDER_GRADE = 'V4';
export const DEFAULT_ROPE_GRADE = '6a';

// Grade normalization utilities

export function vScaleToNumber(grade: string): number | null {
  const m = /^v\s*(\d+)$/i.exec(grade.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

export function frenchToIndex(g: string): number | null {
  const idx = FRENCH_GRADES.findIndex((x) => x.toLowerCase() === g.trim().toLowerCase());
  return idx >= 0 ? idx : null;
}

export function normalizeGrade(type: 'boulder' | 'rope', grade: string): string {
  const g = grade.trim().toLowerCase();
  if (type === 'boulder') {
    const n = vScaleToNumber(g);
    return n != null ? `v${n}` : g.replace(/\s+/g, '');
  }
  const idx = frenchToIndex(g);
  return idx != null ? FRENCH_GRADES[idx] : g.replace(/\s+/g, '');
}
