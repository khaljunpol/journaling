"use client";
import dynamic from 'next/dynamic';

const Overview = dynamic(() => import('@/components/overview/Overview'), { ssr: false, loading: () => <OverviewSkeleton /> });

function OverviewSkeleton() {
    return (
        <div className="mx-auto w-full max-w-[1280px] space-y-3 lg:space-y-4" aria-busy="true" aria-label="Loading overview">
            <div className="h-[50px] w-48 rounded-[10px]" style={{ background: "var(--surface-2)" }} />
            {/* Same grid as the 3 Overview questions. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-64 rounded-[14px] ${i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`} style={{ background: "var(--surface-2)" }} />
                ))}
            </div>
        </div>
    );
}

/** Home: how is my week. The same page on every device. */
export default function Page() {
    return <Overview />;
}
