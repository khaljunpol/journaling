import Link from 'next/link';
import { parseLocalDate } from '@/lib/date';

type Bar = { date: string; filled: number; total: number };

/** Last N days. Bar height = items logged out of items counted. Tap a bar to open that day in Today. */
export default function BarStrip({ bars, today }: { bars: Bar[]; today: string }) {
  return (
    <ul className="grid grid-cols-7 gap-x-1 gap-y-2 sm:grid-cols-14 sm:gap-x-1.5">
      {bars.map((b) => {
        const d = parseLocalDate(b.date);
        const share = b.total > 0 ? b.filled / b.total : 0;
        const isToday = b.date === today;
        const long = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        return (
          <li key={b.date}>
            <Link
              href={`/quick?date=${b.date}`}
              aria-label={`${long}: ${b.filled} of ${b.total} logged. Open in Today`}
              className="flex min-h-11 flex-col items-stretch gap-1 rounded-[10px] px-0.5 py-1 hover:bg-[var(--surface-2)]"
            >
              <span className="relative block h-14 overflow-hidden rounded-[6px]" style={{ background: 'var(--surface-3)' }}>
                <span
                  className="absolute inset-x-0 bottom-0 block rounded-[6px]"
                  style={{ height: `${Math.max(share * 100, b.filled > 0 ? 8 : 0)}%`, background: 'var(--accent)' }}
                />
              </span>
              <span className="num text-center text-[12px] leading-none" style={{ color: isToday ? 'var(--accent)' : 'var(--text-3)', fontWeight: isToday ? 600 : 400 }}>
                {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                <span className="block pt-0.5 text-[11px]">{d.getDate()}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
