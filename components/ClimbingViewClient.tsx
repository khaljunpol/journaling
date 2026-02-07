"use client";

import dynamic from 'next/dynamic';

const ClimbingView = dynamic(() => import('@/components/ClimbingView'), {
  ssr: false,
  loading: () => <div className="p-4">Loading climbing…</div>,
});

export default function ClimbingViewClient() {
  return <ClimbingView />;
}
