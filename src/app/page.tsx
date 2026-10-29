"use client";
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { shouldOpenToday } from '@/lib/routes';

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

export default function Page() {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    // On a phone-width screen "/" opens Today (unless ?stay=1). Skeleton first, so no dashboard flash.
    useEffect(() => {
        if (shouldOpenToday(window.innerWidth, window.location.search)) {
            router.replace('/quick');
            return;
        }
        setReady(true);
    }, [router]);

    return ready ? <Overview /> : <OverviewSkeleton />;
}
