"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '@/lib/useAccount';
import { localTodayISO } from '@/lib/date';
import type { Activity, Log } from '@/lib/types';

export default function TodayChecklist() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const today = useMemo(() => localTodayISO(), []);
  const account = useAccount();

  async function fetchActivities() {
    try {
      const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`);
      if (!res.ok) { setActivities([]); return; }
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      setActivities([]);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch(`/api/logs?date=${today}&account=${encodeURIComponent(account)}`);
      if (!res.ok) { setLogs([]); return; }
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
  }

  useEffect(() => {
    fetchActivities();
    fetchLogs();
  }, [account]);

  async function toggle(activityId: string, checked: boolean) {
    const res = await fetch(`/api/logs?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, activityId, completed: checked }) });
    if (!res.ok) {
      let msg = 'Failed to update log';
      try { const j = await res.json(); msg = j?.error || msg; } catch {}
      console.error(msg);
      return;
    }
    fetchLogs();
  }

  function isChecked(id: string) {
    return logs.find((l) => l.activityId === id)?.completed ?? false;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Today</h2>
      <ul className="space-y-2">
        {activities.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <input type="checkbox" checked={isChecked(a.id)} onChange={(e) => toggle(a.id, e.target.checked)} />
            <span>{a.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
