import type { TimeSlice } from '@journaling/core/overview';

/** Time split. Own SVG ring with the total in the middle and a legend. Colours are the category colours. */
export default function Donut({
  slices,
  total,
  centreLabel = 'h',
  unit = 'h',
  meta,
}: {
  slices: TimeSlice[];
  total: number;
  centreLabel?: string;
  /** Written after each slice value in the legend. */
  unit?: string;
  /** Optional small second line per slice id. */
  meta?: Record<string, string>;
}) {
  const size = 112;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((a, s) => a + (s.hours / total) * c, 0));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} ${centreLabel === 'h' ? 'hours' : centreLabel} logged`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const len = (s.hours / total) * c;
          const dash = Math.max(len - 1.5, 0);
          return (
            <circle
              key={s.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-starts[i]}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="num" fill="var(--text-1)" fontSize="20" fontWeight="500">
          {total}
          <tspan fontSize="12" fill="var(--text-2)" dx="2">{centreLabel}</tspan>
        </text>
      </svg>
      <ul className="min-w-36 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ color: 'var(--text-1)' }}>{s.name}</span>
              {meta?.[s.id] && <span className="block truncate text-[12px]" style={{ color: 'var(--text-3)' }}>{meta[s.id]}</span>}
            </span>
            <span className="num" style={{ color: 'var(--text-2)' }}>{s.hours}{unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
