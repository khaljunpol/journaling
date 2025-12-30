export type ActivitySuggestion = { name: string; tags: string[]; insight: string };

export const SUGGESTED_ACTIVITIES: ActivitySuggestion[] = [
  { name: 'coffee', tags: ['caffeine', 'habit'], insight: 'High frequency may impact sleep; consider moderation.' },
  { name: 'gym', tags: ['exercise', 'strength'], insight: 'Aim 3–5 days/week for consistent progress.' },
  { name: 'squash', tags: ['exercise', 'cardio'], insight: 'Good cardio; plan rest days to avoid overuse.' },
  { name: 'climb', tags: ['exercise', 'strength'], insight: 'Focus on grip and recovery between sessions.' },
  { name: 'crossfit', tags: ['exercise', 'intensity'], insight: 'Balance intensity with recovery and nutrition.' },
  { name: 'alcohol', tags: ['consumption'], insight: 'Frequent use can impact recovery and sleep.' },
  { name: 'creatine', tags: ['supplement'], insight: 'Daily adherence improves benefits over time.' },
  { name: 'protein powder', tags: ['supplement', 'nutrition'], insight: 'Useful to meet daily protein targets.' },
  { name: 'vitamins', tags: ['supplement'], insight: 'Daily routine aids micronutrient coverage.' },
  { name: 'video games', tags: ['leisure', 'screen-time'], insight: 'Balance leisure with sleep and activity.' },
  { name: 'post story', tags: ['content', 'social'], insight: 'Consistency helps engagement; avoid burnout.' },
  { name: 'post reel', tags: ['content', 'social'], insight: 'Batch creation can reduce daily overhead.' },
];
