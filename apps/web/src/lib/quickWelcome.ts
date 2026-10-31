// Pure rules for the first-run welcome on Today. Imports only types, so tests can load it.
import type { QuickPayload } from '@journaling/core/quickPayload';
import type { DayData } from '@journaling/core/quickDay';

export type WelcomeStep = { key: 'habits' | 'log' | 'reminder'; done: boolean };

function hasData(d: DayData): boolean {
  return (
    d.mood !== null ||
    d.weight !== null ||
    d.highlight.trim() !== '' ||
    d.logs.length > 0 ||
    d.climbs > 0 ||
    d.sidequestLogIds.length > 0 ||
    d.hours.some((h) => h !== null)
  );
}

/** The 3 first-run steps: add habits, log today, turn on the reminder (optional). */
export function welcomeSteps(payload: QuickPayload, today: string): WelcomeStep[] {
  const t = payload.days[today];
  return [
    { key: 'habits', done: payload.ctx.activities.length > 0 },
    { key: 'log', done: !!t && hasData(t) },
    { key: 'reminder', done: payload.reminderEnabled },
  ];
}

/** Only for someone just starting: no habits yet, or nothing logged in the loaded days. */
export function showWelcome(payload: QuickPayload, today: string, dismissed: boolean): boolean {
  if (dismissed) return false;
  if (welcomeSteps(payload, today).every((s) => s.done)) return false;
  const anyData = Object.values(payload.days).some(hasData);
  return payload.ctx.activities.length === 0 || !anyData;
}
