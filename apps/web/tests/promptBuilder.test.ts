import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJournalPrompt, buildTimePrompt, getPromptPeriod } from '../src/lib/promptBuilder.ts';

describe('summary prompt builder', () => {
  it('builds Monday-start weekly and calendar-month ranges', () => {
    assert.deepEqual(getPromptPeriod('2026-06-26', 'week'), {
      fromISO: '2026-06-22',
      toISO: '2026-06-28',
      label: 'week of June 22, 2026',
    });
    assert.deepEqual(getPromptPeriod('2026-06-26', 'month'), {
      fromISO: '2026-06-01',
      toISO: '2026-06-30',
      label: 'June 2026',
    });
  });

  it('builds a journal prompt with mood, activities, highlights, and weight', () => {
    const prompt = buildJournalPrompt({
      period: 'week',
      fromISO: '2026-06-22',
      toISO: '2026-06-28',
      label: 'week of June 22, 2026',
      activities: [{ id: 'gym', name: 'gym' }, { id: 'vitamins', name: 'vitamins' }],
      logs: [
        { date: '2026-06-22', activityId: 'gym', completed: true },
        { date: '2026-06-22', activityId: 'vitamins', completed: true },
        { date: '2026-06-23', activityId: 'gym', completed: false },
      ],
      moods: [{ date: '2026-06-22', score: 7 }],
      highlights: [{ date: '2026-06-22', highlight: 'Good gym session' }],
      weights: [{ date: '2026-06-22', weight: 72.4 }],
    });

    assert.match(prompt, /Analyze my journal data for the week of June 22, 2026/);
    assert.match(prompt, /gym: 1\/2 days completed/);
    assert.match(prompt, /vitamins: 1\/1 days completed/);
    assert.match(prompt, /2026-06-22: mood 7\/10; highlight: Good gym session; weight 72.4/);
  });

  it('builds a time prompt with category totals and daily breakdowns', () => {
    const prompt = buildTimePrompt({
      period: 'month',
      fromISO: '2026-06-01',
      toISO: '2026-06-30',
      label: 'June 2026',
      categories: [
        { id: '1', name: 'work', color: '#f59e0b', order: 1 },
        { id: '2', name: 'sleep', color: '#0ea5e9', order: 2 },
      ],
      entries: [
        { date: '2026-06-22', hour: 9, category: 1 },
        { date: '2026-06-22', hour: 10, category: 1 },
        { date: '2026-06-22', hour: 0, category: 2 },
      ],
    });

    assert.match(prompt, /Analyze my time tracking data for June 2026/);
    assert.match(prompt, /work: 2h/);
    assert.match(prompt, /sleep: 1h/);
    assert.match(prompt, /2026-06-22: 3h total; work 2h; sleep 1h/);
  });
});
