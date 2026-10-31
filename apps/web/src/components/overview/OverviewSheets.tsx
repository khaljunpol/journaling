'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Sheet from '@/components/ui/Sheet';
import { parseLocalDate } from '@/lib/date';
import { hm } from '@/lib/overviewStats';
import { SLEEP_CUT, type OverviewView } from './derive';
import { signed } from './Section';
import TrendTable from './TrendTable';

export type OverviewDetail = 'mood' | 'habits' | 'time';

const H = 'mb-2 text-[12px] font-medium uppercase tracking-[0.04em]';
const Head = ({ children }: { children: ReactNode }) => <h3 className={H} style={{ color: 'var(--text-3)' }}>{children}</h3>;
const Quiet = ({ children }: { children: ReactNode }) => <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>{children}</p>;

function TrendsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press -ml-2 inline-flex min-h-11 items-center rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }}>
      {children}
    </Link>
  );
}

/** Label, a bar (value / max) and the value in mono. Static: sheets open at the final size. */
function ValueRow({ label, value, max, text, color = 'var(--accent)' }: { label: ReactNode; value: number | null; max: number; text: ReactNode; color?: string }) {
  return (
    <li className="flex min-h-8 items-center gap-2 text-[14px]">
      <span className="w-28 shrink-0 truncate" style={{ color: 'var(--text-1)' }}>{label}</span>
      <span className="relative h-2.5 min-w-0 flex-1 rounded-full" style={{ background: 'var(--surface-3)' }} aria-hidden="true">
        {value !== null ? (
          <span className="absolute inset-0 overflow-hidden rounded-full">
            <span className="bar-x absolute inset-0 block" style={{ transform: `scaleX(${Math.min(1, value / max)})`, background: color }} />
          </span>
        ) : null}
      </span>
      <span className="num w-24 shrink-0 text-right" style={{ color: 'var(--text-2)' }}>{text}</span>
    </li>
  );
}

function MoodSheet({ mood, open, onClose }: { mood: NonNullable<OverviewView['mood']>; open: boolean; onClose: () => void }) {
  const { split, nights, weekday, hasSleep } = mood.sheet;
  const maxNight = Math.max(9, ...nights.map((n) => n.hours ?? 0));
  const known = nights.filter((n) => n.hours !== null);
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  return (
    <Sheet open={open} onClose={onClose} title="Mood & sleep" subtitle="Last 90 days" initialFocus="panel">
      <div className="space-y-6 pt-2">
        <section>
          <Head>Mood after a night of</Head>
          {split ? (
            <ul>
              <ValueRow label={`${SLEEP_CUT}h+ sleep`} value={split.hi} max={10} text={<>{split.hi} · {days(split.nHi)}</>} />
              <ValueRow label={`under ${SLEEP_CUT}h`} value={split.lo} max={10} text={<>{split.lo} · {days(split.nLo)}</>} />
            </ul>
          ) : (
            <Quiet>{hasSleep ? 'Needs 10 days with mood and sleep, at least 3 on each side of 7h.' : 'Log sleep in your hours (a category named Sleep) to see this.'}</Quiet>
          )}
        </section>

        <section>
          <Head>Sleep, last 14 nights</Head>
          {known.length ? (
            <div>
              <div className="relative flex h-24 items-end gap-1" role="img" aria-label={`Sleep per night: ${known.map((n) => `${parseLocalDate(n.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })} ${hm(n.hours as number)}`).join(', ')}. Guide line at ${SLEEP_CUT}h.`}>
                {/* The 7h guide lives inside the 96px bars box, so its offset is measured from the bars' base. */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed" style={{ bottom: `${(SLEEP_CUT / maxNight) * 100}%`, borderColor: 'var(--text-3)' }} />
                {nights.map((n) => (
                  <div key={n.date} className="relative h-full min-w-0 flex-1 overflow-hidden rounded-[4px]">
                    {n.hours === null ? (
                      <span className="absolute inset-x-0 bottom-0 block h-[2px] rounded-full" style={{ background: 'var(--border-strong)' }} />
                    ) : (
                      <span className="bar-y absolute inset-0 block" style={{ transform: `scaleY(${n.hours / maxNight})`, background: 'var(--sync)' }} />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>Dashed line: {SLEEP_CUT}h</p>
            </div>
          ) : (
            <Quiet>{hasSleep ? 'No sleep logged in the last 14 nights.' : 'No Sleep category yet.'}</Quiet>
          )}
        </section>

        <section>
          <Head>Mood by weekday</Head>
          {weekday.some((d) => d.avg !== null) ? (
            <ul>
              {weekday.map((d) => (
                <ValueRow key={d.day} label={d.day} value={d.avg} max={10} text={d.avg !== null ? d.avg : <span style={{ color: 'var(--text-3)' }}>no mood</span>} />
              ))}
            </ul>
          ) : (
            <Quiet>No moods in the last 90 days.</Quiet>
          )}
        </section>

        <TrendsLink href="/trends?tab=mood">Mood on Trends ›</TrendsLink>
      </div>
    </Sheet>
  );
}

function HabitsSheet({ habits, open, onClose }: { habits: NonNullable<OverviewView['habits']>; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Habits" subtitle="Last 14 days" initialFocus="panel">
      <div className="space-y-6 pt-2">
        <TrendTable rows={habits.table} />
        <p className="text-[14px]" style={{ color: 'var(--text-1)' }}>
          Best streak this year: <span className="num">{habits.best}</span> {habits.best === 1 ? 'day' : 'days'}
        </p>
        <TrendsLink href="/trends?tab=habits">Habits on Trends ›</TrendsLink>
      </div>
    </Sheet>
  );
}

function TimeSheet({ time, open, onClose }: { time: NonNullable<OverviewView['time']>; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Time" subtitle="This week vs the same days last week" initialFocus="panel">
      <div className="space-y-6 pt-2">
        <table className="w-full text-[14px]">
          <thead>
            <tr className={H} style={{ color: 'var(--text-3)' }}>
              <th scope="col" className="pb-2 text-left font-medium">Category</th>
              <th scope="col" className="pb-2 text-right font-medium">This week</th>
              <th scope="col" className="pb-2 text-right font-medium">Last week</th>
              <th scope="col" className="pb-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {time.all.map((r) => {
              const d = r.hours - r.prev;
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <th scope="row" className="py-2 pr-2 text-left font-normal" style={{ color: 'var(--text-1)' }}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: r.color }} aria-hidden="true" />
                    {r.name}
                  </th>
                  <td className="num py-2 text-right" style={{ color: 'var(--text-1)' }}>{r.hours}h</td>
                  <td className="num py-2 text-right" style={{ color: 'var(--text-2)' }}>{r.prev}h</td>
                  <td className="num py-2 text-right" style={{ color: d > 0 ? 'var(--accent)' : 'var(--text-2)' }}>{d === 0 ? 'same' : signed(d, 'h')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TrendsLink href="/trends?tab=time">Time on Trends ›</TrendsLink>
      </div>
    </Sheet>
  );
}

/** Rendered as a sibling of the page grid, never inside an `.ov-in` wrapper (its transform would trap `position: fixed`). */
export default function OverviewSheets({ view, open, onClose }: { view: OverviewView; open: OverviewDetail | null; onClose: () => void }) {
  return (
    <>
      {view.mood ? <MoodSheet mood={view.mood} open={open === 'mood'} onClose={onClose} /> : null}
      {view.habits ? <HabitsSheet habits={view.habits} open={open === 'habits'} onClose={onClose} /> : null}
      {view.time ? <TimeSheet time={view.time} open={open === 'time'} onClose={onClose} /> : null}
    </>
  );
}
