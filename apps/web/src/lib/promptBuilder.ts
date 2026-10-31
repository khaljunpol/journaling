import { localISO, parseLocalDate, weekStartLocal } from '@journaling/core/date';
import type { TimeCategory } from './types';

export type PromptPeriod = 'week' | 'month';

type Activity = { id: string; name: string };
type ActivityLog = { date: string; activityId: string; completed: boolean };
type MoodEntry = { date: string; score: number };
type HighlightEntry = { date: string; highlight: string };
type WeightEntry = { date: string; weight: number };
type TimeEntry = { date: string; hour: number; category: number };

export type JournalPromptInput = {
  period: PromptPeriod;
  fromISO: string;
  toISO: string;
  label: string;
  activities: Activity[];
  logs: ActivityLog[];
  moods: MoodEntry[];
  highlights: HighlightEntry[];
  weights: WeightEntry[];
};

export type TimePromptInput = {
  period: PromptPeriod;
  fromISO: string;
  toISO: string;
  label: string;
  categories: TimeCategory[];
  entries: TimeEntry[];
};

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getPromptPeriod(anchorISO: string, period: PromptPeriod) {
  const anchor = parseLocalDate(anchorISO);
  if (period === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return {
      fromISO: localISO(start),
      toISO: localISO(end),
      label: formatMonth(anchor),
    };
  }

  const start = weekStartLocal(anchor);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return {
    fromISO: localISO(start),
    toISO: localISO(end),
    label: `week of ${formatLongDate(start)}`,
  };
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

function countDays(fromISO: string, toISO: string): string[] {
  const days: string[] = [];
  const current = parseLocalDate(fromISO);
  const end = parseLocalDate(toISO);
  while (current <= end) {
    days.push(localISO(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function buildJournalPrompt(input: JournalPromptInput): string {
  const days = countDays(input.fromISO, input.toISO);
  const activityById = new Map(input.activities.map((a) => [a.id, a.name]));
  const moodByDate = new Map(input.moods.map((m) => [m.date, m.score]));
  const highlightByDate = new Map(input.highlights.map((h) => [h.date, h.highlight]));
  const weightByDate = new Map(input.weights.map((w) => [w.date, w.weight]));
  const logsByActivity = new Map<string, { done: number; total: number }>();

  for (const log of input.logs) {
    const current = logsByActivity.get(log.activityId) || { done: 0, total: 0 };
    current.total += 1;
    if (log.completed) current.done += 1;
    logsByActivity.set(log.activityId, current);
  }

  const activityLines = [...logsByActivity.entries()]
    .map(([id, stat]) => `${activityById.get(id) || id}: ${stat.done}/${stat.total} days completed`)
    .sort();

  const moodScores = input.moods.map((m) => Number(m.score)).filter(Number.isFinite);
  const dailyLines = days.map((date) => {
    const parts: string[] = [];
    const mood = moodByDate.get(date);
    const highlight = highlightByDate.get(date);
    const weight = weightByDate.get(date);
    if (typeof mood === 'number') parts.push(`mood ${mood}/10`);
    if (highlight) parts.push(`highlight: ${highlight}`);
    if (typeof weight === 'number') parts.push(`weight ${weight}`);
    return parts.length ? `${date}: ${parts.join('; ')}` : `${date}: no journal details logged`;
  });

  return [
    `Analyze my journal data for the ${input.label}.`,
    '',
    'Please give me:',
    '1. A concise summary of how I seem to be doing',
    '2. Patterns in mood, activities, routines, highlights, and weight if relevant',
    '3. What seems to be helping',
    '4. What seems to be draining or inconsistent',
    '5. 3 practical suggestions for the next period',
    '',
    'Use only the data below. Do not diagnose medical or mental health conditions. If the data is limited, say so.',
    '',
    `Date range: ${input.fromISO} to ${input.toISO}`,
    `Mood entries: ${input.moods.length}/${days.length}`,
    `Average mood: ${average(moodScores) ?? 'not enough data'}`,
    '',
    'Activities:',
    activityLines.length ? activityLines.join('\n') : 'No activity logs in this period.',
    '',
    'Daily journal details:',
    dailyLines.join('\n'),
  ].join('\n');
}

export function buildTimePrompt(input: TimePromptInput): string {
  const days = countDays(input.fromISO, input.toISO);
  const categoryById = new Map(input.categories.map((c) => [Number(c.id), c.name]));
  const totals = new Map<number, number>();
  const byDate = new Map<string, Map<number, number>>();

  for (const entry of input.entries) {
    totals.set(entry.category, (totals.get(entry.category) || 0) + 1);
    const day = byDate.get(entry.date) || new Map<number, number>();
    day.set(entry.category, (day.get(entry.category) || 0) + 1);
    byDate.set(entry.date, day);
  }

  const totalHours = input.entries.length;
  const totalLines = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, hours]) => `${categoryById.get(category) || category}: ${hours}h`);

  const dailyLines = days.map((date) => {
    const day = byDate.get(date);
    if (!day) return `${date}: 0h logged`;
    const hours = [...day.values()].reduce((sum, v) => sum + v, 0);
    const breakdown = [...day.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => `${categoryById.get(category) || category} ${count}h`)
      .join('; ');
    return `${date}: ${hours}h total; ${breakdown}`;
  });

  return [
    `Analyze my time tracking data for ${input.label}.`,
    '',
    'Please give me:',
    '1. A concise summary of how my time is being spent',
    '2. Patterns in work, sleep, rest, hobbies, routines, and balance based on category names',
    '3. What seems healthy or sustainable',
    '4. What seems overloaded, neglected, or inconsistent',
    '5. 3 practical suggestions for the next period',
    '',
    'Use only the data below. Do not diagnose anything. If category names are ambiguous, say what you are inferring.',
    '',
    `Date range: ${input.fromISO} to ${input.toISO}`,
    `Total logged hours: ${totalHours}`,
    `Average logged hours per day: ${Math.round((totalHours / days.length) * 10) / 10}`,
    '',
    'Category totals:',
    totalLines.length ? totalLines.join('\n') : 'No time logs in this period.',
    '',
    'Daily time details:',
    dailyLines.join('\n'),
  ].join('\n');
}
