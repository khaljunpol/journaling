// The Vantage design tokens: one source for the web app's CSS variables and the widget's colours.
// Keys are the CSS variable names without the leading dashes. After a change run `npm run css -w @journaling/design`.

export const dark = {
  bg: '#090b11',
  surface: '#10131c',
  'surface-2': '#171b28',
  'surface-3': '#1f2433',
  border: '#1e2432',
  'border-strong': '#2b3247',
  'text-1': '#f3f5f9',
  'text-2': '#a4aec4',
  'text-3': '#7a84a0',
  accent: '#9b8cff', // text, icons, focus
  'accent-fill': '#6a5ae0', // button bg, with white text
  'on-accent-fill': '#ffffff',
  'accent-soft': 'rgba(124, 108, 242, 0.14)',
  reward: '#f0a24a',
  'reward-text': '#f0a24a',
  'on-reward': '#1a1206',
  ok: '#34d399',
  'ok-soft': 'rgba(52, 211, 153, 0.14)',
  sync: '#38bdf8',
  warn: '#fb7185',
  'shadow-card': 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.35)',
  'shadow-pop': '0 16px 48px rgba(0, 0, 0, 0.55)',
  ring: 'rgba(155, 140, 255, 0.4)',
} as const;

export const light: Record<keyof typeof dark, string> = {
  bg: '#f6f7f9',
  surface: '#ffffff',
  'surface-2': '#f0f2f5',
  'surface-3': '#e7eaef',
  border: '#e4e7ed',
  'border-strong': '#d3d8e2',
  'text-1': '#0b1020',
  'text-2': '#566180',
  'text-3': '#5f6880',
  accent: '#5b4be0',
  'accent-fill': '#5b4be0',
  'on-accent-fill': '#ffffff',
  'accent-soft': 'rgba(91, 75, 224, 0.10)',
  reward: '#f0a24a',
  'reward-text': '#a85a0c',
  'on-reward': '#1a1206',
  ok: '#0b7a4d',
  'ok-soft': 'rgba(11, 122, 77, 0.12)',
  sync: '#0369a1',
  warn: '#be123c',
  'shadow-card': '0 1px 2px rgba(16, 24, 40, 0.05)',
  'shadow-pop': '0 12px 32px -8px rgba(16, 24, 40, 0.18)',
  ring: 'rgba(91, 75, 224, 0.3)',
};

/** The same in both themes: radii, easing and the type scale. */
export const shared = {
  'radius-card': '14px',
  'radius-inner': '10px',
  'radius-full': '9999px',
  'ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
  'ease-rise': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'ease-drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
  'text-label': '12px',
  'text-meta': '13px',
  'text-body': '14px',
  'text-card-title': '16px',
  'text-section': '20px',
  'text-page': '24px',
  'text-kpi': '28px',
} as const;

const lines = (tokens: Record<string, string>) =>
  Object.entries(tokens).map(([k, v]) => `  --${k}: ${v};`).join('\n');

/** The whole of tokens.css. Dark is the default theme. */
export function tokensCss(): string {
  return [
    '/* Generated from src/tokens.ts. Do not edit by hand. */',
    `:root {\n  color-scheme: dark;\n${lines(dark)}\n${lines(shared)}\n}`,
    `:root[data-theme="light"] {\n  color-scheme: light;\n${lines(light)}\n}`,
    '',
  ].join('\n');
}
