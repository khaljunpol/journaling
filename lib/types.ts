// Activity tracking
export type ActivityStatus = 'to stop' | 'to continue';
export type Activity = { id: string; name: string; status?: ActivityStatus };
export type Log = { date: string; activityId: string; completed: boolean };
export type Week = { week: string; rate: number };

// Metrics
export type MetricsSummary = { avgRate: number; bestWeek: { week: string; rate: number } | null; currentStreakDays: number; totalCompletions: number };
export type ActivitySeries = { id: string; name: string; weeks: Array<{ week: string; rate: number; done: number; total: number }> };

// Weight & Mood
export type WeightPoint = { date: string; weight: number };
export type MoodItem = { date: string; score: number };
export type DaySummary = {
  date: string;
  score: number;
  logs: Array<{ activityId: string; completed: boolean }>;
  activities: Array<{ id: string; name: string }>;
  highlight: string;
  weight: number | null;
  climbLogs: Array<{ grade: string; type: string; attempts: number }>;
};

// Time tracker
export type TimeCategory = { id: string; name: string; color: string; order: number };
export type TimeEntry = { date: string; hour: number; category: number };
export type TimeEntryAny = { date: string; hour: number; category: number | string };

// Climbing
export type ClimbType = 'boulder' | 'rope';
export type ClimbLog = { id: string; date: string; session: number; type: ClimbType; grade: string; attempts: number; location?: string; notes?: string };
export type ClimbGoal = { id: string; year: number; type: ClimbType; grade: string; target: number };
