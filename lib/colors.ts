// Semantic colors used across components
export const COLORS = {
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  accent: '#fc4c02',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
  emerald: '#10b981',
} as const;

// Chart line/bar color palette (ordered for visual distinction)
export const CHART_COLORS = [
  COLORS.danger,
  COLORS.warning,
  COLORS.emerald,
  COLORS.blue,
  COLORS.purple,
  COLORS.pink,
  COLORS.teal,
] as const;
