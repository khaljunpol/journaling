'use client';

import { useCallback, useEffect, useState } from 'react';
import { canGoNext, mondayOf, shiftWeek, weekDates, weekRange } from '@journaling/core/quickWeek';

/** Which week the strip shows, which day was tapped, and loading a past week from the server. */
export function useWeek(
  today: string | null,
  confirmed: boolean,
  fetchRange: (from: string, to: string) => Promise<void>,
) {
  const [picked, setPicked] = useState<{ week: string; date: string } | null>(null);
  const [away, setAway] = useState<string | null>(null); // a past Monday, or null for the current week
  const current = today ? mondayOf(today) : null;
  const shown = away ?? current;
  const isCurrent = shown !== null && shown === current;
  const dates = shown ? weekDates(shown) : [];
  // A tap only counts for the week it was made in.
  const tapped = picked && picked.week === shown ? picked.date : null;

  useEffect(() => {
    if (!confirmed || !today || !away) return;
    const { from, to } = weekRange(away, today);
    void fetchRange(from, to);
  }, [confirmed, today, away, fetchRange]);

  const move = useCallback(
    (weeks: number) => {
      if (!today || !shown) return;
      const next = shiftWeek(shown, weeks, today);
      setAway(next === mondayOf(today) ? null : next);
    },
    [today, shown],
  );

  return {
    shown,
    isCurrent,
    dates,
    tapped,
    canNext: today && shown ? canGoNext(shown, today) : false,
    prev: () => move(-1),
    next: () => move(1),
    toToday: () => setAway(null),
    pick: (date: string) => shown && setPicked({ week: shown, date }),
    /** Jump to a day in any past or current week (used by ?date= links from Overview). */
    goTo: (date: string) => {
      if (!today || date > today) return;
      const monday = mondayOf(date);
      setAway(monday === mondayOf(today) ? null : monday);
      setPicked({ week: monday, date });
    },
  };
}
