"use client";
import dynamic from 'next/dynamic';
const Dashboard = dynamic(() => import('@/components/Dashboard'), { ssr: false, loading: () => <div className="p-4">Loading dashboard…</div> });

export default function Page() {
    return <Dashboard />;
}
