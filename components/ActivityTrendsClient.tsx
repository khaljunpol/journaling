"use client";

import dynamic from 'next/dynamic';

const ActivityTrends = dynamic(() => import('@/components/ActivityTrends'), {
  ssr: false,
  loading: () => <div className="card p-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading trends…</div>,
});

export default function ActivityTrendsClient() {
  return <ActivityTrends />;
}
