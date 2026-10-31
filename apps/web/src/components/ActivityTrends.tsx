"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import { getCache, setCache } from '@/lib/cache';
import { localTodayISO, parseLocalDate } from '@journaling/core/date';
import { habitGrid, lastDates } from '@journaling/core/overview';
import { addDaysISO } from '@journaling/core/quickWeek';
import type { Activity, Log } from '@/lib/types';

const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;
const PHONE_DAYS = 84; // 12 weeks
const DESKTOP_DAYS = 365;

function setLeft(el: HTMLElement, x: number) {
  el.scrollLeft = x;
}

/**
 * Habits as a heatmap: one row per active habit, one square per day, most often done first.
 * Each strip scrolls sideways inside the card; all strips scroll together and start at today.
 */
export default function ActivityTrends() {
  const today = useMemo(() => localTodayISO(), []);
  const [habits, setHabits] = useState<Activity[] | null>(() => getCache<Activity[]>('activities')?.data ?? null);
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);
  const [picked, setPicked] = useState<{ name: string; date: string; done: boolean } | null>(null);
  const strips = useRef<Map<string, HTMLDivElement>>(new Map());
  const syncing = useRef(false);

  const dayCount = wide ? DESKTOP_DAYS : PHONE_DAYS;
  const days = useMemo(() => lastDates(today, dayCount), [today, dayCount]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const from = addDaysISO(today, -(DESKTOP_DAYS - 1));
    const key = `logs:${from}|${today}`;
    const cached = getCache<Log[]>(key);
    if (cached && Array.isArray(cached.data)) setLogs(cached.data);
    void (async () => {
      try {
        const [aRes, lRes] = await Promise.all([
          fetch('/api/activities', { signal: ctrl.signal }),
          fetch(`/api/logs?from=${from}&to=${today}`, { signal: ctrl.signal }),
        ]);
        const a: Activity[] = aRes.ok ? await aRes.json() : [];
        const l: Log[] = lRes.ok ? await lRes.json() : [];
        if (ctrl.signal.aborted) return;
        const acts = Array.isArray(a) ? a : [];
        setHabits(acts);
        setLogs(Array.isArray(l) ? l : []);
        try { setCache('activities', acts); setCache(key, Array.isArray(l) ? l : []); } catch { /* cache is optional */ }
      } catch {
        if (!ctrl.signal.aborted) { setHabits((p) => p ?? []); setLogs((p) => p ?? []); }
      }
    })();
    return () => ctrl.abort();
  }, [today]);

  const grid = useMemo(() => {
    return habitGrid(habits ?? [], logs ?? [], days);
  }, [habits, logs, days]);

  // Start every strip at today (the right end), and keep them in step when one is scrolled.
  const scrollToEnd = useCallback(() => {
    for (const el of strips.current.values()) setLeft(el, el.scrollWidth);
  }, []);
  // The strips only exist once both fetches are done, so wait for that too (the row count alone can stay the same).
  const ready = habits !== null && logs !== null;
  useEffect(() => { if (ready) scrollToEnd(); }, [ready, grid.rows.length, dayCount, scrollToEnd]);

  function onStripScroll(id: string) {
    if (syncing.current) return;
    const src = strips.current.get(id);
    if (!src) return;
    syncing.current = true;
    for (const [k, el] of strips.current) if (k !== id) setLeft(el, src.scrollLeft);
    requestAnimationFrame(() => { syncing.current = false; });
  }

  const width = days.length * STEP;
  const monthMarks = useMemo(() => {
    const marks: Array<{ x: number; label: string }> = [];
    days.forEach((d, i) => {
      if (d.endsWith('-01')) marks.push({ x: i * STEP, label: parseLocalDate(d).toLocaleDateString(undefined, { month: 'short' }) });
    });
    return marks;
  }, [days]);

  if (habits === null || logs === null) {
    return (
      <Card>
        <CardHeader title="Habits" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }
  if (grid.rows.length === 0) {
    return <EmptyState title="No active habits yet" hint="Add habits in Settings and they show up here." />;
  }

  return (
    <Card>
      <CardHeader title="Habits" meta={<span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{wide ? 'Last 12 months' : 'Last 12 weeks'}</span>} />
      <p className="num mb-3 text-[14px]" style={{ color: 'var(--text-2)' }}>
        Last 7 days <strong style={{ color: 'var(--text-1)' }}>{grid.week}%</strong> · Week before <strong style={{ color: 'var(--text-1)' }}>{grid.prevWeek}%</strong>
      </p>

      <div className="mb-1 flex items-end gap-2">
        <div className="flex-1 overflow-hidden" aria-hidden="true">
          <div
            ref={(el) => { if (el) strips.current.set('axis', el); else strips.current.delete('axis'); }}
            onScroll={() => onStripScroll('axis')}
            className="nav-scroll overflow-x-auto"
          >
            <svg width={width} height={14} className="block">
              {monthMarks.map((m) => (
                <text key={m.x} x={m.x} y={10} fontSize="10" fill="var(--text-3)">{m.label}</text>
              ))}
            </svg>
          </div>
        </div>
        <span className="w-[74px] shrink-0" />
      </div>

      <ul className="space-y-2">
        {grid.rows.map((r) => (
          <li key={r.id}>
            <div className="mb-0.5 truncate text-[14px]" style={{ color: 'var(--text-1)' }} title={r.name}>{r.name}</div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 overflow-hidden rounded-[6px]">
                <div
                  ref={(el) => { if (el) strips.current.set(r.id, el); else strips.current.delete(r.id); }}
                  onScroll={() => onStripScroll(r.id)}
                  className="nav-scroll overflow-x-auto"
                >
                  <svg width={width} height={CELL} className="block" role="img" aria-label={`${r.name}: ${r.done.filter(Boolean).length} of ${days.length} days done`}>
                    {r.done.map((done, i) => (
                      <rect
                        key={days[i]}
                        x={i * STEP}
                        y={0}
                        width={CELL}
                        height={CELL}
                        rx={2}
                        fill={done ? 'var(--accent)' : 'var(--surface-3)'}
                        stroke={picked && picked.name === r.name && picked.date === days[i] ? 'var(--text-1)' : 'none'}
                        strokeWidth={1.5}
                        onClick={() => setPicked({ name: r.name, date: days[i], done })}
                      >
                        <title>{`${days[i]}: ${done ? 'done' : 'not done'}`}</title>
                      </rect>
                    ))}
                  </svg>
                </div>
              </div>
              <span className="num w-[74px] shrink-0 text-right text-[12px]" style={{ color: 'var(--text-2)' }}>{r.rate30}% · 30d</span>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 min-h-5 text-[13px]" style={{ color: 'var(--text-2)' }} aria-live="polite">
        {picked
          ? `${picked.name} · ${parseLocalDate(picked.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${picked.done ? 'done' : 'not done'}`
          : 'Tap a square for that day. Scroll sideways for older days.'}
      </p>
    </Card>
  );
}
