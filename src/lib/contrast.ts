// Pure: which text colour reads on a given background colour. No imports.

/** 'light' text on dark colours, 'dark' text on light ones (WCAG relative luminance). Unknown input reads as light paint. */
export function inkOn(hex: string): 'light' | 'dark' {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return 'dark';
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  // Contrast with black (L+0.05)/0.05 vs with white 1.05/(L+0.05): pick the bigger one.
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? 'dark' : 'light';
}
