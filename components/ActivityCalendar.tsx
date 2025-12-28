"use client";

import { useEffect, useMemo, useState } from 'react';

type Activity = { id: string; name: string };
 type Log = { date: string; activityId: string; completed: boolean };

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function ActivityCalendar({ selectedDateISO, onSelectDate }: { selectedDateISO?: string; onSelectDate?: (dateISO: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const today = new Date();
  const todayY = today.getUTCFullYear();
  const todayM = today.getUTCMonth();
  const todayD = today.getUTCDate();
  const [account, setAccount] = useState<string>('Alex');

  useEffect(() => {
    const init = typeof window !== 'undefined' ? localStorage.getItem('account') : null;
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1), [year, month]);
  const fromISO = useMemo(() => `${year}-${pad(month + 1)}-01`, [year, month]);
  const toISO = useMemo(() => `${year}-${pad(month + 1)}-${pad(daysInMonth(year, month))}`, [year, month]);

  async function fetchActivities() {
    try {
      const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`);
      if (!res.ok) { setActivities([]); return; }
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch { setActivities([]); }
  }

  async function fetchRangeLogs() {
    try {
      const res = await fetch(`/api/logs?from=${fromISO}&to=${toISO}&account=${encodeURIComponent(account)}`);
      if (!res.ok) { setLogs({}); return; }
      const data: Log[] = await res.json();
      const map: Record<string, boolean> = {};
      for (const l of Array.isArray(data) ? data : []) {
        map[`${l.date}|${l.activityId}`] = !!l.completed;
      }
      setLogs(map);
    } catch { setLogs({}); }
  }

  useEffect(() => { fetchActivities(); }, [account]);
  useEffect(() => { fetchRangeLogs(); }, [fromISO, toISO, account]);

  async function toggle(dateISO: string, activityId: string, checked: boolean) {
    const res = await fetch(`/api/logs?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateISO, activityId, completed: checked }) });
    if (!res.ok) return;
    setLogs((prev) => ({ ...prev, [`${dateISO}|${activityId}`]: checked }));
  }

  function cellChecked(dateISO: string, activityId: string) {
    return logs[`${dateISO}|${activityId}`] ?? false;
  }

  function prevMonth() {
    setMonth((m) => (m === 0 ? 11 : m - 1));
    setYear((y) => (month === 0 ? y - 1 : y));
  }

  function nextMonth() {
    setMonth((m) => (m === 11 ? 0 : m + 1));
    setYear((y) => (month === 11 ? y + 1 : y));
  }

  const selectedDay = useMemo(() => {
    if (!selectedDateISO) return undefined;
    const d = new Date(selectedDateISO);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month) return undefined;
    return d.getUTCDate();
  }, [selectedDateISO, year, month]);

  function selectDay(day: number) {
    const dateISO = `${year}-${pad(month + 1)}-${pad(day)}`;
    onSelectDate?.(dateISO);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="rounded border px-2 py-1" onClick={prevMonth}>Prev</button>
        <div className="font-medium">{new Date(Date.UTC(year, month, 1)).toLocaleString(undefined, { month: 'long' })} {year}</div>
        <button className="rounded border px-2 py-1" onClick={nextMonth}>Next</button>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white p-2 text-left dark:bg-neutral-950">Activity</th>
              {days.map((d) => (
                <th key={d} className={`p-2 text-xs font-medium ${selectedDay === d ? 'bg-neutral-100 dark:bg-neutral-900' : ''}`}>
                  <button
                    className={`cursor-pointer rounded-full px-3 py-1 transition-colors ${
                      selectedDay === d
                        ? 'bg-black text-white ring-2 ring-blue-500 dark:bg-white dark:text-black dark:ring-blue-400'
                        : (year === todayY && month === todayM && d === todayD)
                          ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                          : 'bg-neutral-200 text-black hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    onClick={() => selectDay(d)}
                    aria-pressed={selectedDay === d}
                    title={`Select ${year}-${pad(month + 1)}-${pad(d)}`}
                  >
                    {d}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td className="sticky left-0 bg-white p-2 text-sm dark:bg-neutral-950">{a.name}</td>
                {days.map((d) => {
                  const dateISO = `${year}-${pad(month + 1)}-${pad(d)}`;
                  const checked = cellChecked(dateISO, a.id);
                  const isSelected = selectedDay === d;
                  const isToday = year === todayY && month === todayM && d === todayD;
                  return (
                    <td
                      key={d}
                      className={`p-2 text-center ${
                        isSelected
                          ? 'bg-neutral-50 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700'
                          : isToday
                            ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800'
                            : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggle(dateISO, a.id, e.target.checked)}
                        onFocus={() => selectDay(d)}
                        aria-label={`Toggle ${a.name} on ${dateISO}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
