'use client';

import { useEffect, useState, type MutableRefObject } from 'react';
import { dayStatus, habitLogSpecs, missingInOrder, type ItemKey } from '@/lib/quickDay';
import { hoursEntries } from '@/lib/quickApply';
import type { QuickPayload } from '@/lib/quickPayload';
import { loadCatchup, saveCatchup } from '@/lib/quickStore';
import {
  DAILY_KINDS,
  catchUpSteps,
  datesUpTo,
  habitFillPlan,
  habitMessage,
  onlyFor,
  sanitizeChoice,
  templateFillPlan,
  templateMessage,
  type CatchUpStep,
} from '@/lib/quickWeek';
import type { SaveSpec } from './editors/types';

type Args = {
  email: string;
  today: string | null;
  yesterday: string | null;
  payload: QuickPayload | null;
  payloadRef: MutableRefObject<QuickPayload | null>;
  shown: string | null;
  dates: string[];
  commit: (specs: SaveSpec[]) => void;
};

/** The catch-up choice (kept on the phone), the steps of a week run, the week summary and the template fill. */
export function useCatchUp({ email, today, yesterday, payload, payloadRef, shown, dates, commit }: Args) {
  const [choice, setChoice] = useState<ItemKey[]>(DAILY_KINDS);
  const [chosen, setChosen] = useState(false);
  const [tplMsg, setTplMsg] = useState<{ week: string; text: string } | null>(null);
  const [habitMsg, setHabitMsg] = useState<{ week: string; text: string } | null>(null);

  useEffect(() => {
    const saved = email ? loadCatchup(email) : null;
    setChoice(sanitizeChoice(saved));
    setChosen(saved !== null);
  }, [email]);

  /** Older days count only the chosen kinds. */
  const onlyOf = (date: string) => (yesterday ? onlyFor(date, yesterday, choice) : undefined);

  const upToToday = today ? datesUpTo(dates, today) : [];
  const loaded = !!payload && !!today && upToToday.every((d) => payload.days[d]);

  /** Loaded days up to today with every empty kind; catchUpSteps applies the kinds. */
  function stepsFor(kinds: ItemKey[]): CatchUpStep[] {
    if (!today || !payload) return [];
    const days = upToToday.flatMap((date) => {
      const day = payload.days[date];
      return day ? [{ date, missing: missingInOrder(dayStatus(day, payload.ctx, { only: kinds })) }] : [];
    });
    return catchUpSteps(days, today, kinds);
  }

  function summary(): string | null {
    if (!payload || !loaded) return null;
    let filled = 0;
    let total = 0;
    for (const d of upToToday) {
      const s = dayStatus(payload.days[d], payload.ctx, { only: onlyOf(d) });
      filled += s.filled;
      total += s.total;
    }
    return `${filled} of ${total} filled`;
  }

  function saveChoice(next: ItemKey[]) {
    setChoice(next);
    setChosen(true);
    if (email) saveCatchup(email, next);
  }

  function fillHours() {
    const p = payloadRef.current;
    if (!p || !today || !shown) return;
    const days = upToToday.flatMap((d) => (p.days[d] ? [{ date: d, hours: p.days[d].hours }] : []));
    const plan = templateFillPlan(days, today, p.templates, p.ctx.categoryIds);
    commit(
      plan.fills.map((f) => ({
        key: `hours:${f.date}`,
        url: '/api/time',
        method: 'POST' as const,
        body: { date: f.date, entries: hoursEntries(f.hours) },
      })),
    );
    setTplMsg({ week: shown, text: templateMessage(plan) });
  }

  function fillHabits() {
    const p = payloadRef.current;
    if (!p || !today || !shown) return;
    const days = upToToday.flatMap((d) => (p.days[d] ? [{ date: d, logs: p.days[d].logs }] : []));
    const plan = habitFillPlan(days, today, p.habitTemplates, p.ctx.activities);
    commit(plan.fills.flatMap((f) => habitLogSpecs(f.date, f.rows)));
    setHabitMsg({ week: shown, text: habitMessage(plan) });
  }

  return {
    choice,
    chosen,
    onlyOf,
    loaded,
    stepsFor,
    summary,
    saveChoice,
    fillHours,
    fillHabits,
    message: tplMsg && tplMsg.week === shown ? tplMsg.text : null,
    habitMessage: habitMsg && habitMsg.week === shown ? habitMsg.text : null,
  };
}
