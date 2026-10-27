/** Tiny line, own SVG. Decorative: the number next to it says the same thing. */
export default function Sparkline({
  values,
  min,
  max,
  color = 'var(--accent)',
}: {
  values: number[];
  min?: number;
  max?: number;
  color?: string;
}) {
  const W = 100;
  const H = 28;
  const PAD = 2;
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--surface-3)" strokeWidth={2} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - PAD - ((v - lo) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
