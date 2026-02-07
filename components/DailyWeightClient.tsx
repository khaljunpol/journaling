"use client";

import dynamic from 'next/dynamic';

const DailyWeight = dynamic(() => import('@/components/DailyWeight'), {
    ssr: false,
    loading: () => (
        <div className="card p-4 animate-pulse">
            <div className="h-5 w-28 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="mt-3 h-20 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
    ),
});

export default DailyWeight;
