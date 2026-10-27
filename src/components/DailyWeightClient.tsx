"use client";

import dynamic from 'next/dynamic';
import Skeleton from '@/components/ui/Skeleton';

const DailyWeight = dynamic(() => import('@/components/DailyWeight'), {
  ssr: false,
  loading: () => <Skeleton className="h-11 w-full" />,
});

export default DailyWeight;
