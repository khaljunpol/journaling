"use client";

import dynamic from 'next/dynamic';
import Skeleton from '@/components/ui/Skeleton';

const ClimbingView = dynamic(() => import('@/components/ClimbingView'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

export default function ClimbingViewClient() {
  return <ClimbingView />;
}
