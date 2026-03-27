// Cross-domain insight computations for the dashboard.
// Pure functions — no API calls, no side effects.

import type { MoodItem } from '@/lib/types';

type LogEntry = { date: string; activityId: string; completed: boolean };
type ActivityEntry = { id: string; name: string };
type GoalStat = { label: string; percent: number; onTrack: 'ahead' | 'on track' | 'behind' };

// ─── Mood ↔ Activity correlation ─────────────────────────────────────────────

export function computeMoodActivityCorrelation(
  moods: MoodItem[],
  logs: LogEntry[],
  activities: ActivityEntry[],
): { highDayAvg: number; lowDayAvg: number; threshold: number; sufficient: boolean } | null {
  if (!moods.length || !logs.length || !activities.length) return null;

  const moodByDate = new Map(moods.map(m => [m.date, m.score]));
  const logsByDate = new Map<string, LogEntry[]>();
  for (const l of logs) {
    if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
    logsByDate.get(l.date)!.push(l);
  }

  // Only count days where both mood and logs exist
  const paired: Array<{ date: string; score: number; rate: number }> = [];
  for (const [date, score] of moodByDate) {
    const dayLogs = logsByDate.get(date);
    if (!dayLogs || dayLogs.length === 0) continue;
    const done = dayLogs.filter(l => l.completed).length;
    const rate = done / dayLogs.length;
    paired.push({ date, score, rate });
  }

  const sufficient = paired.length >= 14;
  if (paired.length < 7) return null;

  const threshold = 0.75;
  const high = paired.filter(p => p.rate >= threshold);
  const low = paired.filter(p => p.rate < threshold);

  if (!high.length || !low.length) return null;

  const avg = (arr: typeof high) => Math.round((arr.reduce((s, p) => s + p.score, 0) / arr.length) * 10) / 10;

  return { highDayAvg: avg(high), lowDayAvg: avg(low), threshold, sufficient };
}

// ─── Weekly summary sentence ─────────────────────────────────────────────────

export function computeWeeklySummary({
  moodAvg7,
  moodPrevAvg,
  thisWeekRate,
  lastWeekRate,
  climbSessionsThisWeek,
  balance,
}: {
  moodAvg7: number | null;
  moodPrevAvg: number | null;
  thisWeekRate: number;
  lastWeekRate: number;
  climbSessionsThisWeek: number;
  balance: { productive: number; rest: number; sleep: number };
}): string {
  const parts: string[] = [];

  // Mood
  if (moodAvg7 !== null) {
    const moodStr = `mood ${moodAvg7}/10`;
    if (moodPrevAvg !== null) {
      const delta = Math.round((moodAvg7 - moodPrevAvg) * 10) / 10;
      if (delta > 0.5) parts.push(`${moodStr} (up from ${moodPrevAvg})`);
      else if (delta < -0.5) parts.push(`${moodStr} (down from ${moodPrevAvg})`);
      else parts.push(moodStr);
    } else {
      parts.push(moodStr);
    }
  }

  // Activities
  const pct = Math.round(thisWeekRate * 100);
  if (pct > 0) {
    const vs = lastWeekRate > 0 ? ` (was ${Math.round(lastWeekRate * 100)}%)` : '';
    parts.push(`${pct}% activities${vs}`);
  }

  // Climbing
  if (climbSessionsThisWeek > 0) {
    parts.push(`climbed ${climbSessionsThisWeek}x`);
  }

  // Balance
  const total = balance.productive + balance.rest + balance.sleep;
  if (total > 0) {
    const prodPct = Math.round((balance.productive / total) * 100);
    if (prodPct > 60) parts.push(`productive-heavy week (${prodPct}%)`);
    else if (prodPct < 30 && balance.productive > 0) parts.push(`light on productive time (${prodPct}%)`);
  }

  if (parts.length === 0) return 'No data logged this week yet.';

  // Determine tone
  const isGood = (moodAvg7 ?? 5) >= 6.5 && pct >= 70;
  const isRough = (moodAvg7 ?? 5) < 5 || pct < 40;
  const prefix = isGood ? 'Good week' : isRough ? 'Tough week' : 'This week';

  return `${prefix} — ${parts.join(', ')}.`;
}

// ─── Attention signals ───────────────────────────────────────────────────────

export type Signal = {
  type: 'warning' | 'positive';
  message: string;
};

export function computeAttentionSignals({
  moods7,
  streakDays,
  climbSessionsThisWeek,
  climbSessionsLastWeek,
  goalStats,
  moodAvg7,
  moodPrevAvg,
}: {
  moods7: MoodItem[];
  streakDays: number;
  climbSessionsThisWeek: number;
  climbSessionsLastWeek: number;
  goalStats: GoalStat[];
  moodAvg7: number | null;
  moodPrevAvg: number | null;
}): Signal[] {
  const signals: Signal[] = [];

  // Mood declining
  if (moods7.length >= 3) {
    const sorted = [...moods7].sort((a, b) => a.date.localeCompare(b.date));
    const last3 = sorted.slice(-3);
    const declining = last3.every((m, i) => i === 0 || m.score <= last3[i - 1].score) && last3[0].score - last3[last3.length - 1].score >= 2;
    if (declining) {
      signals.push({ type: 'warning', message: `Mood has dropped ${last3[0].score - last3[last3.length - 1].score} points over ${last3.length} days.` });
    }
  }

  // Mood improving
  if (moodAvg7 !== null && moodPrevAvg !== null && moodAvg7 - moodPrevAvg >= 1) {
    signals.push({ type: 'positive', message: `Mood is up — averaging ${moodAvg7}/10 vs ${moodPrevAvg} last week.` });
  }

  // Activity streak
  if (streakDays >= 7) {
    signals.push({ type: 'positive', message: `${streakDays}-day activity streak — keep it going.` });
  }

  // No climbing this week
  if (climbSessionsLastWeek > 0 && climbSessionsThisWeek === 0) {
    signals.push({ type: 'warning', message: 'No climbing sessions this week yet.' });
  }

  // Goals behind pace
  const behind = goalStats.filter(g => g.onTrack === 'behind');
  if (behind.length > 0) {
    const label = behind.map(g => g.label).join(', ');
    signals.push({ type: 'warning', message: `Behind pace on ${label}.` });
  }

  return signals.slice(0, 3);
}
