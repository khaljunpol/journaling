"use client";

import dynamic from 'next/dynamic';

const TimeTrackerView = dynamic(() => import('@/components/TimeTrackerView'), {
  ssr: false,
  loading: () => <div className="p-4">Loading time tracker…</div>,
});

export default function TimeTrackerViewClient() {
  return <TimeTrackerView />;
}
