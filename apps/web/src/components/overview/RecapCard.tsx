import { QUESTION_CLASS } from '@/components/climbing/overview/types';
import Skeleton from '@/components/ui/Skeleton';
import { parseLocalDate } from '@journaling/core/date';
import type { WeekRecap } from '@journaling/core/weekRecap';
import { signed } from './Section';

const short = (iso: string) => parseLocalDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="num truncate text-[18px] font-medium leading-snug" style={{ color: 'var(--text-1)' }}>{value}</p>
      <p className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--text-2)' }}>{label}</p>
    </div>
  );
}

export function RecapSkeleton() {
  return (
    <section className="card p-4 sm:p-5" aria-label="Last week">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-12 w-full" />
    </section>
  );
}

/** Last week: a few numbers and the one line that stands out. Only what was logged shows up. */
export default function RecapCard({ recap }: { recap: WeekRecap }) {
  const { from, to, mood, sleep, habits, days, time, note } = recap;
  const change = mood.delta ? `, ${signed(mood.delta)}` : '';
  const slips = days ? [days.late ? `${days.late} late` : '', days.missed ? `${days.missed} missed` : ''].filter(Boolean).join(', ') : '';
  return (
    <section className="card p-4 sm:p-5" aria-label="Last week">
      <h2 className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>Last week · {short(from)} – {short(to)}</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {mood.avg !== null ? <Stat value={String(mood.avg)} label={`Mood${change}`} /> : null}
        {sleep !== null ? <Stat value={`${sleep}h`} label="Sleep a night" /> : null}
        {habits !== null ? <Stat value={`${habits}%`} label="Habits" /> : null}
        {days ? <Stat value={`${days.onTime} of ${days.onTime + days.late + days.missed}`} label={slips ? `Days on time, ${slips}` : 'Days on time'} /> : null}
        {time ? <Stat value={`${time.hours}h`} label={time.name} /> : null}
      </div>
      {note ? <p className="mt-3 text-[15px]" style={{ color: 'var(--text-1)' }}>{note.text}</p> : null}
    </section>
  );
}
