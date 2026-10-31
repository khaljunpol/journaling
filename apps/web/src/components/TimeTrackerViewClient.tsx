"use client";

import dynamic from 'next/dynamic';
import Skeleton from '@/components/ui/Skeleton';

const TimeTrackerView = dynamic(() => import('@/components/TimeTrackerView'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

export default function TimeTrackerViewClient() {
  return <TimeTrackerView />;
}
