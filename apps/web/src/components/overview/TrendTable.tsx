export type HabitRow = { id: string; name: string; days: boolean[]; pct: number };

/** Habits with a 14-day mini bar row each. Own SVG. Rows are a list, so it also reads well on a narrow card. */
export default function TrendTable({ rows }: { rows: HabitRow[] }) {
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id} className="flex min-h-11 items-center gap-3 border-t py-1.5 first:border-t-0" style={{ borderColor: 'var(--border)' }}>
          <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--text-1)' }}>{r.name}</span>
          <svg viewBox={`0 0 ${r.days.length * 8} 20`} className="h-5 w-28 shrink-0" role="img" aria-label={`${r.days.filter(Boolean).length} of ${r.days.length} days done`}>
            {r.days.map((done, i) => (
              <rect key={i} x={i * 8 + 1} y={done ? 2 : 12} width={6} height={done ? 16 : 6} rx={2} fill={done ? 'var(--accent)' : 'var(--surface-3)'} />
            ))}
          </svg>
          <span className="num w-10 shrink-0 text-right text-[13px]" style={{ color: 'var(--text-2)' }}>{r.pct}%</span>
        </li>
      ))}
    </ul>
  );
}
