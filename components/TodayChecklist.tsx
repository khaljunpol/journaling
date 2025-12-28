"use client";

import { useEffect, useMemo, useState } from 'react';

type Activity = { id: string; name: string };

type Log = { activityId: string; completed: boolean };

export default function TodayChecklist() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function fetchActivities() {
    const res = await fetch('/api/activities');
    const data = await res.json();
    setActivities(data);
  }

  async function fetchLogs() {
    const res = await fetch(`/api/logs?date=${today}`);
    const data = await res.json();
    setLogs(data);
  }

  useEffect(() => {
    fetchActivities();
    fetchLogs();
  }, []);

  async function toggle(activityId: string, checked: boolean) {
    await fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, activityId, completed: checked }) });
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
