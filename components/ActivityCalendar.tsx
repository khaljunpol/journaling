"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityStatus, Activity, Log } from '@/lib/types';
import { normalizeStatus } from '@/lib/status';
import { getCache, setCache } from '@/lib/cache';
import { daysInMonth, pad, localISO } from '@/lib/date';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
  const todayBtnRef = useRef<HTMLButtonElement | null>(null);
  const actsVersionRef = useRef(0);
  const logsVersionRef = useRef(0);
  const actsCtrlRef = useRef<AbortController | null>(null);
  const logsCtrlRef = useRef<AbortController | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1), [year, month]);
  const fromISO = useMemo(() => `${year}-${pad(month + 1)}-01`, [year, month]);
  const toISO = useMemo(() => `${year}-${pad(month + 1)}-${pad(daysInMonth(year, month))}`, [year, month]);

  async function fetchActivities() {
    const vActs = ++actsVersionRef.current;
    try {
      if (actsCtrlRef.current) actsCtrlRef.current.abort();
      actsCtrlRef.current = new AbortController();
      const cacheKey = 'activities';
      const cached = getCache<Activity[]>(cacheKey);
      const applyOrder = (arr: Activity[]) => {
        const orderKey = 'activitiesOrder';
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
        const base = Array.isArray(cached.data) ? cached.data.map((a) => ({ ...a, status: normalizeStatus(a.status as ActivityStatus) })) : [];
        setActivities(applyOrder(base));
      }
      const res = await fetch('/api/activities', { signal: actsCtrlRef.current.signal });
      if (!res.ok) { if (vActs === actsVersionRef.current) setActivities([]); return; }
      const data = await res.json();
      const arr: Activity[] = Array.isArray(data) ? (data as Activity[]).map((a) => ({ ...a, status: normalizeStatus(a.status as ActivityStatus) })) : [];
      if (vActs === actsVersionRef.current) setActivities(applyOrder(arr));
      try { setCache<Activity[]>(cacheKey, arr); } catch {}
    } catch { if (vActs === actsVersionRef.current) setActivities([]); }
  }

  async function fetchRangeLogs() {
    const vLogs = ++logsVersionRef.current;
    try {
      if (logsCtrlRef.current) logsCtrlRef.current.abort();
      logsCtrlRef.current = new AbortController();
      const cacheKey = `logs:${fromISO}|${toISO}`;
      const cached = getCache<Log[]>(cacheKey);
      if (cached && vLogs === logsVersionRef.current) {
        const data = Array.isArray(cached.data) ? cached.data : [];
        const map: Record<string, boolean> = {};
        for (const l of data) { map[`${l.date}|${l.activityId}`] = !!l.completed; }
        setLogs(map);
      }
      const res = await fetch(`/api/logs?from=${fromISO}&to=${toISO}`, { signal: logsCtrlRef.current.signal });
      if (!res.ok) { if (vLogs === logsVersionRef.current) setLogs({}); return; }
      const data: Log[] = await res.json();
      const map: Record<string, boolean> = {};
      for (const l of Array.isArray(data) ? data : []) {
        map[`${l.date}|${l.activityId}`] = !!l.completed;
      }
      if (vLogs === logsVersionRef.current) setLogs(map);
      try { setCache<Log[]>(cacheKey, Array.isArray(data) ? data : []); } catch {}
    } catch { if (vLogs === logsVersionRef.current) setLogs({}); }
  }

  useEffect(() => {
    if (actsCtrlRef.current) actsCtrlRef.current.abort();
    if (logsCtrlRef.current) logsCtrlRef.current.abort();
    setActivities([]);
    setLogs({});
    fetchActivities();
  }, []);
  useEffect(() => { fetchRangeLogs(); }, [fromISO, toISO]);

  useEffect(() => {
    if (year === todayY && month === todayM && todayBtnRef.current) {
      todayBtnRef.current.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [year, month]);

  async function toggle(dateISO: string, activityId: string, checked: boolean) {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateISO, activityId, completed: checked }),
    });
    if (!res.ok) return;
    setLogs((prev) => ({ ...prev, [`${dateISO}|${activityId}`]: checked }));
  }

  function cellChecked(dateISO: string, activityId: string) {
    return logs[`${dateISO}|${activityId}`] ?? false;
  }

  function prevMonth() {
    setMonth((m) => { const nm = m === 0 ? 11 : m - 1; setYear((y) => (m === 0 ? y - 1 : y)); return nm; });
  }
  function nextMonth() {
    setMonth((m) => { const nm = m === 11 ? 0 : m + 1; setYear((y) => (m === 11 ? y + 1 : y)); return nm; });
  }

  const selectedDay = useMemo(() => {
    if (!selectedDateISO) return undefined;
    const d = new Date(selectedDateISO);
    if (d.getFullYear() !== year || d.getMonth() !== month) return undefined;
    return d.getDate();
  }, [selectedDateISO, year, month]);

  function selectDay(day: number) {
    onSelectDate?.(localISO(new Date(year, month, day)));
  }

  return (
    <section className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          aria-label="Previous month"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors"
          style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
        >
          ←
        </button>
        <span className="text-sm font-semibold tracking-wide">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          aria-label="Next month"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors"
          style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
        >
          →
        </button>
      </div>

      {/* Scrollable grid */}
      <div
        className="overflow-auto rounded-2xl"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              {/* Activity column header */}
              <th
                className="sticky left-0 z-10 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ background: 'var(--surface)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}
              >
                Activity
              </th>
              {days.map((d) => {
                const isToday = year === todayY && month === todayM && d === todayD;
                const isSelected = selectedDay === d;
                return (
                  <th
                    key={d}
                    className="px-1 py-3 text-center"
                    style={{ borderBottom: '1px solid var(--border)', minWidth: 36 }}
                  >
                    <button
                      ref={isToday ? (el) => { todayBtnRef.current = el; } : undefined}
                      onClick={() => selectDay(d)}
                      aria-pressed={isSelected}
                      title={localISO(new Date(year, month, d))}
                      className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all"
                      style={
                        isSelected
                          ? { background: 'var(--accent)', color: 'var(--accent-foreground)', boxShadow: '0 0 0 2px var(--accent)' }
                          : isToday
                            ? { background: 'var(--accent)', color: 'var(--accent-foreground)', opacity: 0.6 }
                            : { color: 'var(--muted-foreground)' }
                      }
                    >
                      {d}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activities.map((a, idx) => {
              const isStopped = (a.status || 'to continue') === 'to stop';
              return (
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
                  style={dragOverId === a.id ? { background: 'color-mix(in oklab, var(--accent) 8%, transparent)' } : undefined}
                >
                  {/* Activity name cell */}
                  <td
                    className="sticky left-0 z-10 cursor-move px-4 py-2"
                    style={{
                      background: dragOverId === a.id
                        ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))'
                        : 'var(--surface)',
                      borderTop: idx > 0 ? '1px solid var(--border)' : undefined,
                    }}
                    title="Drag to reorder"
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: isStopped ? 'var(--muted-foreground)' : 'var(--text)',
                        textDecoration: isStopped ? 'line-through' : undefined,
                        fontStyle: isStopped ? 'italic' : undefined,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.name}
                    </span>
                  </td>

                  {/* Day cells */}
                  {days.map((d) => {
                    const dateISO = localISO(new Date(year, month, d));
                    const checked = cellChecked(dateISO, a.id);
                    const isSelected = selectedDay === d;
                    const isTodayCell = year === todayY && month === todayM && d === todayD;
                    return (
                      <td
                        key={d}
                        className="px-1 py-2 text-center"
                        style={{
                          borderTop: idx > 0 ? '1px solid var(--border)' : undefined,
                          background: isSelected
                            ? 'color-mix(in oklab, var(--accent) 6%, transparent)'
                            : isTodayCell
                              ? 'color-mix(in oklab, var(--accent) 4%, transparent)'
                              : undefined,
                        }}
                      >
                        <button
                          onClick={() => { toggle(dateISO, a.id, !checked); selectDay(d); }}
                          aria-label={`Toggle ${a.name} on ${dateISO}`}
                          aria-pressed={checked}
                          className="mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-all"
                          style={
                            checked
                              ? { background: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' }
                              : { border: '1.5px solid var(--border)', background: 'transparent' }
                          }
                        >
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="var(--accent-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
