'use client';

import { Suspense, useMemo, useState } from 'react';
import ActivityTrendsClient from '@/components/ActivityTrendsClient';
import DailyWeight from '@/components/DailyWeightClient';
import InsightsView from '@/components/insights/InsightsView';
import MoodYearGrid from '@/components/MoodYearGrid';
import SummaryPromptPanel from '@/components/SummaryPromptPanel';
import TimeTrackerViewClient from '@/components/TimeTrackerViewClient';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Sheet from '@/components/ui/Sheet';
import Tabs, { TabPanel } from '@/components/ui/Tabs';
import { useRouteTab } from '@/components/shell/RouteTabs';
import WeightTrendChart from '@/components/WeightTrendChart';
import { localTodayISO } from '@journaling/core/date';

const TABS = [
  { id: 'insights', label: 'Insights' },
  { id: 'mood', label: 'Mood' },
  { id: 'time', label: 'Time' },
  { id: 'body', label: 'Body' },
  { id: 'habits', label: 'Habits' },
] as const;

const CONTEXT: Record<string, string> = {
  insights: 'What goes with a better day.',
  mood: 'Your mood, month by month.',
  time: 'Where the hours go.',
  body: 'Weight over time.',
  habits: 'How often each habit gets done.',
};

function TrendsTabs() {
  const tab = useRouteTab(TABS);
  const today = useMemo(() => localTodayISO(), []);
  const [promptOpen, setPromptOpen] = useState(false);
  const isTime = tab === 'time';

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Trends"
        context={CONTEXT[tab]}
        actions={<Button variant="outline" onClick={() => setPromptOpen(true)}>Copy AI prompt</Button>}
      />
      <Tabs tabs={TABS} label="Trends" />

      <TabPanel tabs={TABS} id="insights"><InsightsView today={today} /></TabPanel>
      <TabPanel tabs={TABS} id="mood"><MoodYearGrid /></TabPanel>
      <TabPanel tabs={TABS} id="time"><TimeTrackerViewClient /></TabPanel>
      <TabPanel tabs={TABS} id="body">
        <div className="space-y-3 sm:space-y-4">
          <Card><DailyWeight dateISO={today} /></Card>
          <WeightTrendChart />
        </div>
      </TabPanel>
      <TabPanel tabs={TABS} id="habits"><ActivityTrendsClient /></TabPanel>

      <Sheet open={promptOpen} onClose={() => setPromptOpen(false)} title="Copy AI prompt" subtitle={isTime ? 'Time' : 'Journal'}>
        <SummaryPromptPanel
          key={isTime ? 'time' : 'journal'}
          title={isTime ? 'Time AI prompt' : 'Journal AI prompt'}
          endpoint={isTime ? '/api/prompts/time' : '/api/prompts/journal'}
          anchorISO={today}
        />
      </Sheet>
    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense fallback={null}>
      <TrendsTabs />
    </Suspense>
  );
}
