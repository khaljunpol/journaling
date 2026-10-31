'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import ClimbingViewClient from '@/components/ClimbingViewClient';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import Tabs, { TabPanel } from '@/components/ui/Tabs';

const ClimbingLogView = dynamic(() => import('@/components/ClimbingLogView'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'log', label: 'Log' },
] as const;

function ClimbingTabs() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Climbing" context="Sessions, goals and the year so far." />
      <Tabs tabs={TABS} label="Climbing" />
      <TabPanel tabs={TABS} id="overview"><ClimbingViewClient /></TabPanel>
      <TabPanel tabs={TABS} id="log"><ClimbingLogView /></TabPanel>
    </div>
  );
}

export default function ClimbingPage() {
  return (
    <Suspense fallback={null}>
      <ClimbingTabs />
    </Suspense>
  );
}
