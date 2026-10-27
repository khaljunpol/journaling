"use client";
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { shouldOpenToday } from '@/lib/routes';

const Overview = dynamic(() => import('@/components/overview/Overview'), { ssr: false, loading: () => <OverviewSkeleton /> });

function OverviewSkeleton() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
            <div className="h-8 w-40 rounded-[10px]" style={{ background: "var(--surface-2)" }} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-[14px]" style={{ background: "var(--surface-2)" }} />
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
