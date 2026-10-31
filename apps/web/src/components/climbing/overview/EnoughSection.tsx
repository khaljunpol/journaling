"use client";

import { Card } from '@/components/ui/Card';
import { sendsPerWeek, sessionsCount, weekStreak, weekdayCounts, weeklySeries, type Log } from '@/lib/climbStats';
import { weekStartLocal, localISO, parseLocalDate } from '@/lib/date';
import Answer from './Answer';
import { QUESTION_CLASS, type DetailKind } from './types';

const MONTH_LABELS: Array<[number, string]> = [[0, 'Jan'], [3, 'Apr'], [6, 'Jul'], [9, 'Oct']];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Section 3: am I climbing enough? `allLogs` feed the streak, `yearLogs` the chart; `asOf` is today, or Dec 31 for a past year. */
export default function EnoughSection({ allLogs, yearLogs, year, asOf, onOpen }: { allLogs: Log[]; yearLogs: Log[]; year: number; asOf: string; onOpen: (kind: DetailKind) => void }) {
  const streak = weekStreak(allLogs, asOf);
  const perWeek = sendsPerWeek(allLogs, asOf, 12);
  const series = yearLogs.length ? weeklySeries(yearLogs, `${year}-01-01`, asOf) : [];
  const max = Math.max(1, ...series.map((w) => w.count));
  // The highlighted week is the one holding `asOf`: this week now, the last week of a past year.
  const currentStart = localISO(weekStartLocal(parseLocalDate(asOf)));
  const sessions = sessionsCount(yearLogs);
  const days = weekdayCounts(yearLogs);
  const usual = sessions >= 6
    ? days.map((c, i) => ({ c, i })).filter((d) => d.c > 0).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, 2).sort((a, b) => a.i - b.i).map((d) => WEEKDAYS[d.i])
    : [];
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>Am I climbing enough?</h3>
        <button type="button" className="press ml-auto flex min-h-11 items-center rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={() => onOpen('habits')}>Habits ›</button>
      </div>
      <Answer
        parts={[
          <><span className="num">{streak}</span>-week streak</>,
          <><span className="num">{perWeek}</span> {perWeek === 1 ? 'send' : 'sends'} a week</>,
        ]}
      />
      {series.length ? (
        <>
          <div className="mt-3 flex h-24 items-end gap-px" role="img" aria-label={`Sends each week in ${year}, ${yearLogs.length} in total. Most in one week: ${max}.`}>
            {series.map((w) => (
              <div
                key={w.start}
                className="min-w-0 flex-1 rounded-t-[2px]"
                style={{ height: w.count === 0 ? 2 : `${Math.max(8, (w.count / max) * 100)}%`, background: w.start === currentStart ? 'var(--accent)' : 'var(--border-strong)' }}
              />
            ))}
          </div>
          <div className="relative mt-1 h-4 text-[11px]" style={{ color: 'var(--text-3)' }} aria-hidden="true">
            {MONTH_LABELS.map(([m, name]) => {
              const idx = series.findIndex((w) => w.start >= `${year}-${String(m + 1).padStart(2, '0')}-01`);
              return idx < 0 ? null : <span key={m} className="absolute" style={{ left: `${(idx / series.length) * 100}%` }}>{name}</span>;
            })}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[14px]" style={{ color: 'var(--text-2)' }}>Nothing logged in {year} yet.</p>
      )}
      {usual.length ? <p className="mt-2 text-[13px]" style={{ color: 'var(--text-2)' }}>Usually {usual.join(' + ')}</p> : null}
    </Card>
  );
}
