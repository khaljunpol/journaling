export type ActivityStatus = 'to stop' | 'to continue';
export type Activity = { id: string; name: string; status?: ActivityStatus };
export type Log = { date: string; activityId: string; completed: boolean };
export type Week = { week: string; rate: number };
export type WeightPoint = { date: string; weight: number };

// Mood types reused across views
export type MoodItem = { date: string; score: number };

// Time tracker shared types
export type TimeCategory = { id: string; name: string; color: string; order: number };
export type TimeEntry = { date: string; hour: number; category: number };
export type TimeEntryAny = { date: string; hour: number; category: number | string };

// Climbing shared types
export type ClimbType = 'boulder' | 'rope';
export type ClimbLog = { id: string; date: string; session: number; type: ClimbType; grade: string; attempts: number; location?: string; notes?: string };
export type ClimbGoal = { id: string; year: number; type: ClimbType; grade: string; target: number };
