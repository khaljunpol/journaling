"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClimbingGoalsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/climbing-log');
  }, [router]);
  return (
    <section className="p-4">
      <div className="card p-4">
        <div className="card-title">Climbing Goals</div>
        <div className="subtle">Redirecting to Climbing Log…</div>
      </div>
    </section>
  );
}
