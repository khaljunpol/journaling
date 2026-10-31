"use client";

import dynamic from 'next/dynamic';
import Skeleton from '@/components/ui/Skeleton';

const ActivityTrends = dynamic(() => import('@/components/ActivityTrends'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

export default function ActivityTrendsClient() {
  return <ActivityTrends />;
}
