"use client";

import dynamic from 'next/dynamic';

const MetricsChart = dynamic(() => import('@/components/MetricsChart'), {
  ssr: false,
  loading: () => <div className="p-4">Loading metrics…</div>,
});

export default function MetricsChartClient() {
  return <MetricsChart />;
}
