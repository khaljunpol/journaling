import { CATEGORIES, type HabitCategory } from '@journaling/core/habitCategory';

/** A native select shaped like a chip, so a picker inside a sheet never opens a second sheet. */
export default function CategorySelect({ value, onChange, label }: { value: HabitCategory; onChange: (c: HabitCategory) => void; label: string }) {
  const color = CATEGORIES.find((c) => c.id === value)?.color ?? 'var(--border-strong)';
  return (
    <select
      aria-label={`Category for ${label}`}
      value={value}
      onChange={(e) => onChange(e.target.value as HabitCategory)}
      className="press min-h-11 max-w-[9.5rem] shrink-0 rounded-full border-0 px-3 text-[13px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 18%, var(--surface))`, color: value === 'bad' ? 'var(--text-2)' : 'var(--text-1)' }}
    >
      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select>
  );
}
