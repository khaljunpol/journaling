export type ActivityStatus = 'to stop' | 'to continue';
export type Activity = { id: string; name: string; status?: ActivityStatus; catalogId?: string };
export type CatalogItem = { id: string; name: string; category: string; tags?: string };
export type Log = { date: string; activityId: string; completed: boolean };
export type Week = { week: string; rate: number };
export type WeightPoint = { date: string; weight: number };
