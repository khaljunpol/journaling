'use client';

import type { ReactNode } from 'react';
import { ValueRow } from '@/components/overview/OverviewSheets';
import Sheet from '@/components/ui/Sheet';
import { CATEGORIES } from '@journaling/core/habitCategory';
import type { Finding, HabitsGo, WeekRhythm } from '@journaling/core/insights';

/** Short day count for the narrow value column: "6d". */
const days = (n: number) => `${n}d`;
/** Other is --border-strong, which vanishes on a --surface-3 track: charts draw it in --text-3. */
const chartColor = (c: { id: string; color: string }) => (c.id === 'other' ? 'var(--text-3)' : c.color);
const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

function Head({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-5 text-[13px] font-medium first:mt-0" style={{ color: 'var(--text-2)' }}>{children}</h3>;
}

/** What a finding's two sides are called. */
function sideNames(f: Finding, next: boolean): [string, string] {
  if (f.kind === 'sleep') return ['After 7h+', 'After less'];
  if (f.kind === 'time') return [`${f.cut}h+ ${f.name}`, `Less ${f.name}`];
  return next ? [`After ${f.name}`, 'After other days'] : [f.name, 'Other days'];
}

/** Every link found, each with both sides and their day counts. Lower-mood rows stay neutral. */
export function FindingsSheet({ title, subtitle, findings, next = false, open, onClose }: { title: string; subtitle: string; findings: Finding[]; next?: boolean; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} initialFocus="panel">
      <div className="space-y-5 pt-1">
        {findings.map((f) => {
          const [hiName, loName] = sideNames(f, next);
          return (
            <section key={`${f.kind}:${f.id}`}>
              <Head>
                {f.name} · <span className="num">{f.gap > 0 ? '+' : '−'}{Math.abs(f.gap)}</span>
              </Head>
              <ul>
                <ValueRow label={hiName} value={f.hi} max={10} text={<>{f.hi} · {days(f.nHi)}</>} />
                <ValueRow label={loName} value={f.lo} max={10} color="var(--text-3)" text={<>{f.lo} · {days(f.nLo)}</>} />
              </ul>
            </section>
          );
        })}
        <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Average mood on each side, last 180 days. d = days. Shown only with 5+ days on each side.</p>
      </div>
    </Sheet>
  );
}

/** 12 weekly stacked bars by category, each category's habits, and bad habits as a plain count. */
export function HabitsGoSheet({ go, open, onClose }: { go: HabitsGo; open: boolean; onClose: () => void }) {
  const goodCats = CATEGORIES.filter((c) => c.id !== 'bad');
  const max = Math.max(1, ...go.weeks.map((w) => Object.values(w.counts).reduce((a, b) => a + b, 0)));
  return (
    <Sheet open={open} onClose={onClose} title="Where your habits go" subtitle="Good habits, last 12 weeks" initialFocus="panel">
      <Head>Each week</Head>
      <div
        className="flex h-32 items-end gap-1"
        role="img"
        aria-label={`Checks per week, last 12 weeks: ${go.weeks.map((w) => Object.values(w.counts).reduce((a, b) => a + b, 0)).join(', ')}.`}
      >
        {go.weeks.map((w) => (
          <div key={w.from} className="flex h-full min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-[4px]" style={{ background: 'var(--surface-3)' }}>
            {goodCats.map((c) => {
              const n = w.counts[c.id as keyof typeof w.counts] ?? 0;
              return n ? <span key={c.id} className="block w-full" style={{ height: `${(n / max) * 100}%`, background: chartColor(c) }} /> : null;
            })}
          </div>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]" style={{ color: 'var(--text-2)' }}>
        {goodCats.filter((c) => go.weeks.some((w) => w.counts[c.id as keyof typeof w.counts])).map((c) => (
          <li key={c.id} className="flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: chartColor(c) }} />{c.label}</li>
        ))}
      </ul>

      {go.byCategory.map((c) => {
        const top = Math.max(...c.habits.map((h) => h.done));
        return (
          <section key={c.category}>
            <Head>{catOf(c.category).label} · last 4 weeks</Head>
            <ul>
              {c.habits.map((h) => (
                <ValueRow key={h.id} label={h.name} value={h.done} max={Math.max(top, 1)} color={chartColor(catOf(c.category))} text={<>{h.done}×</>} />
              ))}
            </ul>
          </section>
        );
      })}

      {go.bad ? (
        <>
          <Head>Bad habits</Head>
          <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>
            <span className="num" style={{ color: 'var(--text-1)' }}>{go.bad.thisWeek}</span> {go.bad.thisWeek === 1 ? 'day' : 'days'} this week ·{' '}
            <span className="num" style={{ color: 'var(--text-1)' }}>{go.bad.lastWeek}</span> last week
          </p>
        </>
      ) : null}
    </Sheet>
  );
}

/** Mood and habit % for each weekday. */
export function RhythmSheet({ rhythm, open, onClose }: { rhythm: WeekRhythm; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Week rhythm" subtitle="Last 180 days" initialFocus="panel">
      <Head>Mood</Head>
      <ul>
        {rhythm.mood.map((d) => (
          <ValueRow key={d.day} label={d.day} value={d.avg} max={10} text={d.avg !== null ? <>{d.avg} · {days(d.n)}</> : '–'} />
        ))}
      </ul>
      <Head>Habits done</Head>
      <ul>
        {rhythm.habits.map((d) => (
          <ValueRow key={d.day} label={d.day} value={d.pct} max={100} text={d.pct !== null ? `${d.pct}%` : '–'} />
        ))}
      </ul>
    </Sheet>
  );
}
