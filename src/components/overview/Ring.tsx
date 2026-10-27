/** Today ring. Violet while filling, ember once every item is in. Own SVG. */
export default function Ring({ filled, total, size = 56 }: { filled: number; total: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const closed = total > 0 && filled >= total;
  const share = total > 0 ? Math.min(1, filled / total) : 0;
  const color = closed ? 'var(--reward)' : 'var(--accent)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={closed ? 'Day complete' : `${filled} of ${total} done`} className="shrink-0">
      <g key={closed ? 'closed' : 'open'} className={closed ? 'ring-pop' : undefined}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </g>
    </svg>
  );
}
