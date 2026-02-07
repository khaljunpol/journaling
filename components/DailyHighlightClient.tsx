"use client";

import dynamic from 'next/dynamic';

const DailyHighlight = dynamic(() => import('@/components/DailyHighlight'), {
  ssr: false,
  loading: () => (
    <div className="card p-4 animate-pulse">
      <div className="h-5 w-36 bg-neutral-200 dark:bg-neutral-800 rounded" />
      <div className="mt-3 h-12 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
    </div>
  ),
});

export default DailyHighlight;
