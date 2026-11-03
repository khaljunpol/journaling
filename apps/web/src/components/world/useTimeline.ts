'use client';

import { useEffect, useState } from 'react';
import type { Timeline } from '@journaling/core/world';

/** GET /api/world/timeline once, for "Watch your year". Not cached: it is only read when the mode opens. */
export function useTimeline(): { timeline: Timeline | null; failed: boolean } {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/world/timeline')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('read failed'))))
      .then((t: Timeline) => { if (!cancelled && Array.isArray(t?.weeks) && t.weeks.length) setTimeline(t); else if (!cancelled) setFailed(true); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  return { timeline, failed };
}
