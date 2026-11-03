// Turns the sheet reads into the insights input. A failed or odd read becomes an empty list, never a throw.
import type { InsightInput } from '@journaling/core/insights';

type Raw = { moods: unknown; hours: unknown; logs: unknown; activities: unknown; cats: unknown };

const objects = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const hasDate = (x: Record<string, unknown>) => typeof x.date === 'string';

export function insightInputFrom(raw: Raw, today: string): InsightInput {
  return {
    today,
    moods: objects(raw.moods).filter(hasDate) as InsightInput['moods'],
    hours: objects(raw.hours).filter(hasDate) as InsightInput['hours'],
    logs: objects(raw.logs).filter((x) => hasDate(x) && typeof x.activityId === 'string') as InsightInput['logs'],
    activities: objects(raw.activities).filter((x) => typeof x.id === 'string') as InsightInput['activities'],
    cats: objects(raw.cats).filter((x) => x.id !== undefined) as InsightInput['cats'],
  };
}
