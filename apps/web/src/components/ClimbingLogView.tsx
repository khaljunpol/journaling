"use client";

import { useEffect, useRef, useState } from 'react';
import { localTodayISO, parseLocalDate } from '@journaling/core/date';
import { clearCacheByPrefix } from '@/lib/cache';
import { logMatchesGoal } from '@/lib/climbStory';
import Link from 'next/link';
import { ToastHost, useToast } from '@/components/ui/Toast';
import ShareStorySheet from '@/components/climbing/ShareStorySheet';
import QuickLog from '@/components/climbing/QuickLog';
import { AllLogs, TodayList } from '@/components/climbing/LogList';
import LogEditSheet from '@/components/climbing/LogEditSheet';
import { createOverlayV1, createOverlayV2, createOverlayV3 } from '@/components/climbing/legacyShareImages';
import { logBody, type LogEntry } from '@/components/climbing/types';

type GoalEntry = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

const ALL_LIMIT = 50;

export default function ClimbingLogView() {
  const today = localTodayISO();
  const { show } = useToast();
  const [date, setDate] = useState<string>(today);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  const allSeq = useRef(0);
  const [allPage, setAllPage] = useState<number>(1);
  const [allItems, setAllItems] = useState<LogEntry[]>([]);
  const [allTotal, setAllTotal] = useState<number>(0);
  const [allLoading, setAllLoading] = useState<boolean>(false);
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [yearCache, setYearCache] = useState<Record<number, LogEntry[]>>({});
  // "Share story" sheet: the date it opens on (null = closed)
  const [storyDate, setStoryDate] = useState<string | null>(null);
  const [storyKey, setStoryKey] = useState(0);
  // One climb's overlay when opened from a log row (null = the whole day)
  const [storyClimb, setStoryClimb] = useState<string | null>(null);
  const openStory = (d: string, climbId: string | null = null) => { setStoryKey((k) => k + 1); setStoryClimb(climbId); setStoryDate(d); };
  // Edit sheet: `editing` stays set while the sheet slides out
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function refresh(d = date) {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      const res = await fetch(`/api/climbing/logs?date=${d}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('load failed');
      const items = await res.json();
      if (Array.isArray(items)) setLogs(items);
    } catch (e) {
      // Keep the previous list on a failed load.
      if ((e as Error)?.name !== 'AbortError') show("Couldn't load today's climbs.");
    }
  }

  useEffect(() => { refresh(date); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshAll(page = allPage) {
    const seq = ++allSeq.current;
    setAllLoading(true);
    try {
      const res = await fetch(`/api/climbing/logs?limit=${ALL_LIMIT}&page=${page}`);
      if (!res.ok) return;
      const data = await res.json();
      if (seq !== allSeq.current) return; // a newer request is in flight
      if (data && Array.isArray(data.items)) {
        const total = data.total || 0;
        const last = Math.max(1, Math.ceil(total / ALL_LIMIT));
        if (data.items.length === 0 && page > last) { void refreshAll(last); return; } // deleted the last row of the last page
        setAllItems(data.items);
        setAllTotal(total);
        setAllPage(data.page || 1);
      } else if (Array.isArray(data)) {
        setAllItems(data.slice(0, ALL_LIMIT));
        setAllTotal(data.length);
        setAllPage(1);
      }
    } catch { /* keep the previous list */ } finally { if (seq === allSeq.current) setAllLoading(false); }
  }

  useEffect(() => { refreshAll(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** After any save, undo, edit or delete: reload today's list and the all-logs list. */
  function refreshBoth() {
    clearCacheByPrefix('climb:year:');
    setYearCache({});
    void refresh();
    void refreshAll();
  }
  // Toast actions outlive the render that made them: they call the latest refreshBoth.
  const refreshRef = useRef(refreshBoth);
  useEffect(() => { refreshRef.current = refreshBoth; });
  const refreshLatest = () => refreshRef.current();

  useEffect(() => { (async () => { try { const gRes = await fetch('/api/climbing/goals'); const gs = gRes.ok ? await gRes.json() : []; setGoals(Array.isArray(gs) ? gs : []); } catch { } })(); }, []);

  function openEdit(l: LogEntry) { setEditing(l); setEditOpen(true); }

  async function saveEdit(next: LogEntry): Promise<boolean> {
    try {
      const res = await fetch('/api/climbing/logs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: next.id, ...logBody(next) }) });
      if (!res.ok) throw new Error('save failed');
      setEditOpen(false);
      show('Saved');
      refreshBoth();
      return true;
    } catch {
      show("Couldn't save. Try again.");
      return false;
    }
  }

  async function deleteLog(l: LogEntry) {
    try {
      const res = await fetch(`/api/climbing/logs?id=${encodeURIComponent(l.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      show("Couldn't delete. Try again.");
      return;
    }
    setEditOpen(false);
    refreshBoth();
    let restored = false;
    show('Deleted', {
      label: 'Undo',
      run: () => {
        if (restored) return;
        restored = true;
        void fetch('/api/climbing/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logBody(l)) })
          .then((r) => { if (!r.ok) show("Couldn't undo. Try again."); })
          .catch(() => show("Couldn't undo. Try again."))
          .finally(() => refreshRef.current());
      },
    });
  }

  async function getProgressForLog(l: { id?: string; date: string; type: 'boulder' | 'rope'; grade: string }) {
    const yr = parseLocalDate(l.date).getFullYear();
    let yrLogs = yearCache[yr];
    if (!yrLogs) {
      try {
        const yrStart = `${yr}-01-01`; const yrEnd = `${yr}-12-31`;
        const resp = await fetch(`/api/climbing/logs?from=${yrStart}&to=${yrEnd}`);
        const items = resp.ok ? await resp.json() : [];
        yrLogs = Array.isArray(items) ? items : [];
        setYearCache((prev) => ({ ...prev, [yr]: yrLogs! }));
      } catch { yrLogs = []; }
    }
    const same = (yrLogs || [])
      .filter((x) => logMatchesGoal(x, l))
      .slice()
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
    let ordinal = 0;
    if (l.id) {
      const idx = same.findIndex((x) => x.id === l.id);
      if (idx >= 0) { ordinal = idx + 1; } else {
        const cutoff = parseLocalDate(l.date).getTime();
        ordinal = same.filter((x) => parseLocalDate(x.date).getTime() <= cutoff).length;
      }
    } else {
      const cutoff = parseLocalDate(l.date).getTime();
      ordinal = same.filter((x) => parseLocalDate(x.date).getTime() <= cutoff).length;
    }
    if (ordinal <= 0) ordinal = same.length;
    const goal = (goals || []).find((g) => g.year === yr && logMatchesGoal(l, g));
    const target = goal?.target || 0;
    return { yr, ordinal, target };
  }

  const moreStyles = editing ? [
    { label: 'Centered', run: () => void createOverlayV1(editing, getProgressForLog) },
    { label: 'Compact', run: () => void createOverlayV2(editing, getProgressForLog) },
    { label: 'Bold', run: () => void createOverlayV3(editing, getProgressForLog) },
  ] : [];

  return (
    <section className="space-y-3 sm:space-y-4">
      <h2 className="sr-only">Climbing log</h2>

      <QuickLog today={today} date={date} onDateChange={setDate} onChanged={refreshLatest} />

      <TodayList date={date} today={today} logs={logs} onEdit={openEdit} onShareDay={(d) => openStory(d)} />

      <AllLogs
        items={allItems}
        total={allTotal}
        page={allPage}
        limit={ALL_LIMIT}
        loading={allLoading}
        onPrev={() => { if (allPage > 1) void refreshAll(allPage - 1); }}
        onNext={() => { const maxPage = Math.max(1, Math.ceil(allTotal / ALL_LIMIT)); if (allPage < maxPage) void refreshAll(allPage + 1); }}
        onEdit={openEdit}
        onShareDay={(d) => openStory(d)}
      />

      <p className="px-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
        Goals live on <Link href="/climbing" className="inline-flex min-h-11 items-center font-medium underline" style={{ color: 'var(--accent)' }}>Overview</Link>
      </p>

      <LogEditSheet
        open={editOpen}
        log={editing}
        onClose={() => setEditOpen(false)}
        onSave={saveEdit}
        onDelete={(l) => void deleteLog(l)}
        onShareClimb={(l) => { setEditOpen(false); openStory(l.date.slice(0, 10), l.id); }}
        onShareDay={(d) => { setEditOpen(false); openStory(d); }}
        moreStyles={moreStyles}
      />

      {/* Instagram story: goal + that day's session + charts. The sheet remounts per open so it starts fresh. */}
      <ShareStorySheet
        key={storyKey}
        open={storyDate !== null}
        onClose={() => setStoryDate(null)}
        goals={goals}
        initialDate={storyDate ?? date}
        initialStyle={storyClimb ? 'overlay' : undefined}
        initialClimbId={storyClimb ?? undefined}
      />

      <ToastHost />
    </section>
  );
}
