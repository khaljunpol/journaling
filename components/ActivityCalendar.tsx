"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityStatus, Activity, Log } from '@/lib/types';
import { normalizeStatus } from '@/lib/status';
import { getCache, setCache } from '@/lib/cache';

// Types are imported from shared lib

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalISO(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function ActivityCalendar({ selectedDateISO, onSelectDate }: { selectedDateISO?: string; onSelectDate?: (dateISO: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();
  const [account, setAccount] = useState<string>('Alex');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayBtnRef = useRef<HTMLButtonElement | null>(null);
  const actsVersionRef = useRef(0);
  const logsVersionRef = useRef(0);
  const actsCtrlRef = useRef<AbortController | null>(null);
  const logsCtrlRef = useRef<AbortController | null>(null);
  const [actsUpdatedMs, setActsUpdatedMs] = useState<number | null>(null);
  const [logsUpdatedMs, setLogsUpdatedMs] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    const cookieAccount = (() => {
      try {
        const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      } catch { return null; }
    })();
    const init = cookieAccount || (typeof window !== 'undefined' ? localStorage.getItem('account') : null);
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    const onAccountChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const cookieAcc = (() => {
        try { const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
      })();
      setAccount(detail || cookieAcc || (typeof window !== 'undefined' ? localStorage.getItem('account') : null) || 'Alex');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('account-change', onAccountChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('account-change', onAccountChange as EventListener);
    };
  }, []);

  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1), [year, month]);
  const fromISO = useMemo(() => `${year}-${pad(month + 1)}-01`, [year, month]);
  const toISO = useMemo(() => `${year}-${pad(month + 1)}-${pad(daysInMonth(year, month))}`, [year, month]);

  async function fetchActivities() {
    const vActs = ++actsVersionRef.current;
    try {
      if (actsCtrlRef.current) actsCtrlRef.current.abort();
      actsCtrlRef.current = new AbortController();
      // Apply cached immediately
      const cacheKey = `activities:${account}`;
      const cached = getCache<Activity[]>(cacheKey);
      // Helper to apply persisted order
      const applyOrder = (arr: Activity[]) => {
        const orderKey = `activitiesOrder:${account}`;
        const cachedOrder = getCache<string[]>(orderKey);
        const order = Array.isArray(cachedOrder?.data) ? cachedOrder!.data : [];
        if (!order.length) return arr;
        const idToItem = new Map(arr.map(a => [a.id, a] as const));
        const ordered: Activity[] = [];
        for (const id of order) { const item = idToItem.get(id); if (item) { ordered.push(item); idToItem.delete(id); } }
        for (const item of idToItem.values()) ordered.push(item);
        return ordered;
      };
      if (cached && vActs === actsVersionRef.current) {
        const base = Array.isArray(cached.data) ? cached.data.map((a) => ({ ...a, status: normalizeStatus(a.status as any) })) : [];
        setActivities(applyOrder(base));
        try { setActsUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cached.cachedAt))); } catch {}
      }
      const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { signal: actsCtrlRef.current.signal });
      if (!res.ok) { if (vActs === actsVersionRef.current) setActivities([]); return; }
      const data = await res.json();
      const arr: Activity[] = Array.isArray(data) ? (data as Activity[]).map((a) => ({ ...a, status: normalizeStatus(a.status as any) })) : [];
      if (vActs === actsVersionRef.current) setActivities(applyOrder(arr));
      try { setCache<Activity[]>(cacheKey, arr); } catch {}
      setActsUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
    } catch { if (vActs === actsVersionRef.current) setActivities([]); }
  }

  async function fetchRangeLogs() {
    const vLogs = ++logsVersionRef.current;
    try {
      if (logsCtrlRef.current) logsCtrlRef.current.abort();
      logsCtrlRef.current = new AbortController();
      const cacheKey = `logs:${account}:${fromISO}|${toISO}`;
      const cached = getCache<Log[]>(cacheKey);
      if (cached && vLogs === logsVersionRef.current) {
        const data = Array.isArray(cached.data) ? cached.data : [];
        const map: Record<string, boolean> = {};
        for (const l of data) { map[`${l.date}|${l.activityId}`] = !!l.completed; }
        setLogs(map);
        try { setLogsUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cached.cachedAt))); } catch {}
      }
      const res = await fetch(`/api/logs?from=${fromISO}&to=${toISO}&account=${encodeURIComponent(account)}`, { signal: logsCtrlRef.current.signal });
      if (!res.ok) { if (vLogs === logsVersionRef.current) setLogs({}); return; }
      const data: Log[] = await res.json();
      const map: Record<string, boolean> = {};
      for (const l of Array.isArray(data) ? data : []) {
        map[`${l.date}|${l.activityId}`] = !!l.completed;
      }
      if (vLogs === logsVersionRef.current) setLogs(map);
      try { setCache<Log[]>(cacheKey, Array.isArray(data) ? data : []); } catch {}
      setLogsUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
    } catch { if (vLogs === logsVersionRef.current) setLogs({}); }
  }

  useEffect(() => {
    // Clear on account change and abort in-flight requests
    if (actsCtrlRef.current) actsCtrlRef.current.abort();
    if (logsCtrlRef.current) logsCtrlRef.current.abort();
    setActivities([]);
    setLogs({});
    fetchActivities();
  }, [account]);
  useEffect(() => { fetchRangeLogs(); }, [fromISO, toISO, account]);

  // On load and when month/year changes, scroll horizontally to today's column if visible
  useEffect(() => {
    if (year === todayY && month === todayM && todayBtnRef.current) {
      todayBtnRef.current.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [year, month]);

  async function toggle(dateISO: string, activityId: string, checked: boolean) {
    const res = await fetch(`/api/logs?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateISO, activityId, completed: checked }) });
    if (!res.ok) return;
    setLogs((prev) => ({ ...prev, [`${dateISO}|${activityId}`]: checked }));
  }

  function cellChecked(dateISO: string, activityId: string) {
    return logs[`${dateISO}|${activityId}`] ?? false;
  }

  function prevMonth() {
    setMonth((m) => {
      const nm = m === 0 ? 11 : m - 1;
      setYear((y) => (m === 0 ? y - 1 : y));
      return nm;
    });
  }

  function nextMonth() {
    setMonth((m) => {
      const nm = m === 11 ? 0 : m + 1;
      setYear((y) => (m === 11 ? y + 1 : y));
      return nm;
    });
  }

  const selectedDay = useMemo(() => {
    if (!selectedDateISO) return undefined;
    const d = new Date(selectedDateISO);
    if (d.getFullYear() !== year || d.getMonth() !== month) return undefined;
    return d.getDate();
  }, [selectedDateISO, year, month]);

  function selectDay(day: number) {
    const dateISO = toLocalISO(year, month, day);
    onSelectDate?.(dateISO);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn-outline" onClick={prevMonth}>Prev</button>
        <div className="font-medium">{new Date(year, month, 1).toLocaleString(undefined, { month: 'long' })} {year}</div>
        <button className="btn-outline" onClick={nextMonth}>Next</button>
      </div>
      {(() => { const t = Math.max(actsUpdatedMs ?? 0, logsUpdatedMs ?? 0); return t ? (<div className="subtle text-xs">Updated at {new Date(t).toLocaleTimeString()}</div>) : null; })()}

      <div ref={scrollRef} className="overflow-auto card">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-(--surface) p-2 text-left">Activity</th>
              {days.map((d) => (
                <th key={d} className="p-2 text-xs font-medium" style={selectedDay === d ? { background: 'var(--surface-alt)' } : undefined}>
                  <button
                    ref={year === todayY && month === todayM && d === todayD ? (el) => { todayBtnRef.current = el; } : undefined}
                    className={`cursor-pointer rounded-full px-3 py-1 transition-colors ${
                      selectedDay === d
                        ? 'ring-2'
                        : (year === todayY && month === todayM && d === todayD)
                          ? ''
                          : ''
                    }`}
                    style={
                      selectedDay === d
                        ? { background: 'var(--accent)', color: 'var(--accent-foreground)', outline: 'none', boxShadow: '0 0 0 2px var(--ring)' }
                        : (year === todayY && month === todayM && d === todayD)
                          ? { background: 'var(--accent)', color: 'var(--accent-foreground)', opacity: 0.7 }
                          : { background: 'var(--surface-alt)', color: 'var(--text)' }
                    }
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
              <tr
                key={a.id}
                draggable
                onDragStart={(e) => { setDragId(a.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(a.id); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId || dragId === a.id) { setDragOverId(null); return; }
                  const fromIdx = activities.findIndex(x => x.id === dragId);
                  const toIdx = activities.findIndex(x => x.id === a.id);
                  if (fromIdx < 0 || toIdx < 0) { setDragOverId(null); return; }
                  const next = activities.slice();
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(toIdx, 0, moved);
                  setActivities(next);
                  setDragOverId(null);
                  setDragId(null);
                  try { setCache(`activitiesOrder:${account}`, next.map(x => x.id)); } catch {}
                }}
                onDragEnd={() => { setDragOverId(null); setDragId(null); }}
                style={dragOverId === a.id ? { background: 'var(--surface-alt)' } : undefined}
              >
                <td className="sticky left-0 bg-(--surface) p-2 text-sm cursor-move" title="Drag to reorder">
                  <div className="flex items-center gap-2">
                    <span className={(a.status || 'to continue') === 'to stop' ? 'text-red-600 line-through italic dark:text-red-400' : ''}>
                      {a.name}
                    </span>
                  </div>
                </td>
                {days.map((d) => {
                  const dateISO = toLocalISO(year, month, d);
                  const checked = cellChecked(dateISO, a.id);
                  const isSelected = selectedDay === d;
                  const isToday = year === todayY && month === todayM && d === todayD;
                  return (
                    <td
                      key={d}
                      className="p-2 text-center"
                      style={
                        isSelected
                          ? { background: 'var(--surface-alt)', boxShadow: 'inset 0 0 0 1px var(--border)' }
                          : isToday
                            ? { background: 'color-mix(in oklab, var(--accent) 10%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent)' }
                            : undefined
                      }
                    >
                      <label className="inline-flex cursor-pointer select-none items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-blue-600"
                          checked={checked}
                          onChange={(e) => toggle(dateISO, a.id, e.target.checked)}
                          onFocus={() => selectDay(d)}
                          aria-label={`Toggle ${a.name} on ${dateISO}`}
                        />
                      </label>
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
