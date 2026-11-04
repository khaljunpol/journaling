// Chart look from tokens. Series order (see DESIGN.md, Colors):
// accent, sky, green, rose, slate. Ember (reward) is never used in charts.
export const CHART_SERIES = ['var(--accent)', 'var(--sync)', 'var(--ok)', 'var(--warn)', 'var(--text-3)'] as const;

export const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 12 } as const;

/** recharts Tooltip props: tap or hover shows the value, styled from tokens. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    fontSize: 13,
    color: 'var(--text-1)',
  },
  labelStyle: { color: 'var(--text-2)' },
  itemStyle: { color: 'var(--text-1)' },
  cursor: { fill: 'var(--surface-2)', stroke: 'var(--border-strong)' },
} as const;

export function seriesColor(i: number): string {
  return CHART_SERIES[i % CHART_SERIES.length];
}
