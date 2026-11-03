'use client';

import { useState, type ReactNode } from 'react';
import { PlainAnswer, Section, SectionSkeleton, SubLine } from '@/components/overview/Section';
import { CATEGORIES } from '@journaling/core/habitCategory';
import type { Finding } from '@journaling/core/insights';
import { FindingsSheet, HabitsGoSheet, RhythmSheet } from './InsightSheets';
import { useInsights } from './useInsights';
import YearCalendar from './YearCalendar';

/** Bold for names; N adds tabular figures for numbers. */
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>;
const N = ({ children }: { children: ReactNode }) => <strong className="num font-semibold">{children}</strong>;

/** "On days when **Gym** is done, mood is **1.2** higher." Lower is said plainly, in the quieter tone. */
export function FindingAnswer({ f, next = false }: { f: Finding; next?: boolean }) {
  const what = f.kind === 'time' ? <><N>{f.cut}h+</N> {f.name}</> : <B>{f.name}</B>;
  const lead = next ? <>The day after {what}</> : f.kind === 'habit' ? <>On days when {what} is done</> : f.kind === 'sleep' ? <>On days after {what}</> : <>On days with {what}</>;
  // Lower mood, or any bad habit: the quieter tone. A bad habit never reads as a win.
  const low = f.gap < 0 || f.bad === true;
  return (
    <p className="text-[18px] font-medium leading-snug" style={{ color: low ? 'var(--text-2)' : 'var(--text-1)' }}>
      {lead}, mood is <N>{Math.abs(f.gap)}</N> {f.gap < 0 ? 'lower' : 'higher'}.
    </p>
  );
}

type Open = 'lifts' | 'next' | 'go' | 'rhythm' | null;

/** Trends > Insights: four one-line answers (chart behind "Details ›"), then the year calendar. */
export default function InsightsView({ today }: { today: string }) {
  const { data, failed } = useInsights();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  let cards: ReactNode;
  if (!data) {
    cards = failed ? (
      <PlainAnswer>Couldn&apos;t load insights. Try again later.</PlainAnswer>
    ) : (
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {['What lifts your mood?', 'Next-day effect', 'Where your habits go', 'Week rhythm'].map((q) => <SectionSkeleton key={q} question={q} />)}
      </div>
    );
  } else {
    const { lifts, nextDay, habitsGo: go, rhythm, moreDays } = data;
    const topCat = go ? CATEGORIES.find((c) => c.id === go.top.category) : null;
    const shown = [
      lifts.length ? (
        <Section key="lifts" question="What lifts your mood?" onDetails={() => setOpen('lifts')}>
          <FindingAnswer f={lifts[0]} />
          {lifts.length > 1 ? <SubLine><span className="num">{lifts.length - 1}</span> more {lifts.length === 2 ? 'link' : 'links'} in details.</SubLine> : null}
        </Section>
      ) : null,
      nextDay.length ? (
        <Section key="next" question="Next-day effect" onDetails={() => setOpen('next')}>
          <FindingAnswer f={nextDay[0]} next />
        </Section>
      ) : null,
      go && topCat ? (
        <Section key="go" question="Where your habits go" onDetails={() => setOpen('go')}>
          <PlainAnswer>
            Most habits: <B>{topCat.label}</B> <N>{go.top.pct}%</N>
            {go.top.delta !== null && go.top.delta !== 0 ? <> · <N>{go.top.delta > 0 ? '+' : '−'}{Math.abs(go.top.delta)}</N> on the 4 weeks before</> : null}
          </PlainAnswer>
          <SubLine>Last 4 weeks, good habits.</SubLine>
        </Section>
      ) : null,
      rhythm ? (
        <Section key="rhythm" question="Week rhythm" onDetails={() => setOpen('rhythm')}>
          <PlainAnswer>Best <B>{rhythm.best.day}</B> · lowest <B>{rhythm.low.day}</B></PlainAnswer>
          <SubLine>Mood <span className="num">{rhythm.best.avg}</span> vs <span className="num">{rhythm.low.avg}</span>.</SubLine>
        </Section>
      ) : null,
    ].filter(Boolean);

    cards = (
      <>
        {shown.length ? <div className="grid gap-3 sm:gap-4 md:grid-cols-2">{shown}</div> : null}
        {!lifts.length && !nextDay.length && !rhythm ? (
          <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
            {moreDays > 0 ? <><N>{moreDays}</N> more {moreDays === 1 ? 'day' : 'days'} of mood to see insights.</> : 'No clear mood link yet. Keep logging.'}
          </p>
        ) : null}
        {lifts.length ? <FindingsSheet title="What lifts your mood?" subtitle="Same day" findings={lifts} open={open === 'lifts'} onClose={close} /> : null}
        {nextDay.length ? <FindingsSheet title="Next-day effect" subtitle="Mood the day after" findings={nextDay} next open={open === 'next'} onClose={close} /> : null}
        {go ? <HabitsGoSheet go={go} open={open === 'go'} onClose={close} /> : null}
        {rhythm ? <RhythmSheet rhythm={rhythm} open={open === 'rhythm'} onClose={close} /> : null}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-3 sm:space-y-4">
      {cards}
      <YearCalendar today={today} />
    </div>
  );
}
