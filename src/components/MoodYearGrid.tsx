"use client";

import { getCache, setCache } from '@/lib/cache';
import { localISO } from '@/lib/date';
import { MOODS, moodBackground, moodColor, moodEmoji } from '@/lib/mood';
import type { MoodItem, DaySummary } from '@/lib/types';
import { COLORS } from '@/lib/colors';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';

function moodLabel(score: number): string {
  return MOODS.find((m) => m.score === score)?.label ?? String(score);
}

// ─── Day detail modal ─────────────────────────────────────────────────────────

function DayModal({
  summary,
  avgScore,
  moodItems,
  onClose,
}: {
  summary: DaySummary | 'loading';
  avgScore: number;
  moodItems: MoodItem[];
  onClose: () => void;
}) {
  const dateLabel = summary === 'loading'
    ? '…'
    : new Date(summary.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Modal open onClose={onClose} size="md" mobileSheet className="!p-0 overflow-hidden">
        {summary === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6">
            <div className="text-3xl animate-pulse">...</div>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading day summary</div>
          </div>
        ) : (
          <DayModalContent summary={summary} avgScore={avgScore} dateLabel={dateLabel} moodItems={moodItems} />
        )}
    </Modal>
  );
}

function DayModalContent({
  summary,
  avgScore,
  dateLabel,
  moodItems,
}: {
  summary: DaySummary;
  avgScore: number;
  dateLabel: string;
  moodItems: MoodItem[];
}) {
  const { date, score, logs, activities, highlight, weight, climbLogs } = summary;
  const emoji = moodEmoji(score);
  const label = moodLabel(score);
  const color = moodColor(score);
  const bg = moodBackground(score, 0.12);
  const completedLogs = logs.filter((l) => l.completed);
  const uncompletedLogs = logs.filter((l) => !l.completed);
  const actMap = Object.fromEntries(activities.map((a) => [a.id, a.name]));

  // Mood vs average
  const diff = score - avgScore;
  const diffText = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  const diffColor = diff >= 1 ? COLORS.success : diff <= -1 ? COLORS.danger : 'var(--muted-foreground)';

  // 7-day context: 3 days before + this day + 3 days after
  const contextDays = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    const out: Array<{ dateISO: string; score: number | null; isCurrent: boolean }> = [];
    for (let i = -3; i <= 3; i++) {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + i);
      const iso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
      const found = moodItems.find((m) => m.date === iso);
      out.push({ dateISO: iso, score: found?.score ?? null, isCurrent: i === 0 });
    }
    return out;
  }, [date, moodItems]);

  const hasData = logs.length > 0 || climbLogs.length > 0 || weight !== null || (highlight && highlight.trim().length > 0);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: bg }}>
        <div className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>{dateLabel}</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-5xl leading-none">{emoji}</span>
            <div>
              <div className="text-2xl font-bold" style={{ color }}>{score}<span className="text-base font-normal" style={{ color: 'var(--muted-foreground)' }}>/10</span></div>
              <div className="text-sm font-medium" style={{ color }}>{label}</div>
            </div>
          </div>
          {/* vs average chip */}
          <div className="text-right">
            <div className="text-lg font-bold" style={{ color: diffColor }}>{diffText}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>vs avg</div>
          </div>
        </div>

        {/* 7-day mood sparkline */}
        <div className="mt-3 flex items-end gap-1 justify-center">
          {contextDays.map((cd) => {
            const h = cd.score !== null ? Math.max(6, (cd.score / 10) * 32) : 4;
            const dayLabel = new Date(cd.dateISO + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' });
            return (
              <div key={cd.dateISO} className="flex flex-col items-center gap-0.5" style={{ width: 28 }}>
                <div
                  className="w-3 rounded-full transition-all"
                  style={{
                    height: h,
                    background: cd.score !== null ? moodColor(cd.score) : 'var(--border)',
                    opacity: cd.isCurrent ? 1 : 0.5,
                    outline: cd.isCurrent ? `2px solid ${color}` : undefined,
                    outlineOffset: 1,
                  }}
                />
                <span className="text-[9px]" style={{ color: cd.isCurrent ? color : 'var(--muted-foreground)', fontWeight: cd.isCurrent ? 700 : 400 }}>{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Stats strip */}
        {hasData && (
          <div className="grid grid-cols-3 gap-2">
            {logs.length > 0 && (
              <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'var(--surface-alt)' }}>
                <div className="text-lg font-bold">{completedLogs.length}/{logs.length}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Activities</div>
              </div>
            )}
            {climbLogs.length > 0 && (
              <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'var(--surface-alt)' }}>
                <div className="text-lg font-bold">{climbLogs.length}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Climbs</div>
              </div>
            )}
            {weight !== null && (
              <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'var(--surface-alt)' }}>
                <div className="text-lg font-bold">{weight}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>kg</div>
              </div>
            )}
          </div>
        )}

        {/* Activities */}
        {logs.length > 0 && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Activities</div>
            <div className="flex flex-wrap gap-1.5">
              {completedLogs.map((l) => (
                <span key={l.activityId} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: COLORS.success }}>
                  {actMap[l.activityId] ?? l.activityId}
                </span>
              ))}
              {uncompletedLogs.map((l) => (
                <span key={l.activityId} className="rounded-full px-2.5 py-1 text-xs font-medium line-through" style={{ background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }}>
                  {actMap[l.activityId] ?? l.activityId}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Climbing */}
        {climbLogs.length > 0 && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Climbing</div>
            <div className="flex flex-wrap gap-1.5">
              {climbLogs.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--surface-alt)' }}>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{c.grade.toUpperCase()}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>{c.type}</span>
                  {c.attempts === 0 && <span style={{ color: COLORS.success }}>Flash</span>}
                  {c.attempts > 0 && <span style={{ color: 'var(--muted-foreground)' }}>{c.attempts}att</span>}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Highlight / journal */}
        {highlight && highlight.trim().length > 0 && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Highlight</div>
            <blockquote className="text-sm leading-relaxed" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '0.75rem' }}>
              {highlight.trim()}
            </blockquote>
          </section>
        )}

        {/* Empty state */}
        {!hasData && (
          <div className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>No data logged for this day.</div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MoodYearGrid() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [items, setItems] = useState<MoodItem[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);

  // Selected day state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummary | 'loading' | null>(null);

  // Fetch moods for the entire year
  useEffect(() => {
    async function load() {
      let appliedCache = false;
      try {
        if (ctrlRef.current) ctrlRef.current.abort();
        ctrlRef.current = new AbortController();
        const fromISO = `${year}-01-01`;
        const toISO = `${year}-12-31`;
        const cacheKey = `moods:year:${year}`;
        const cached = getCache<MoodItem[]>(cacheKey);
        if (cached) {
          const valid = Array.isArray(cached.data) ? cached.data.filter((x) => typeof x?.score === 'number' && x?.date) : [];
          const normalized = valid.map((x) => ({ date: x.date.slice(0, 10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
          setItems(normalized);
          try { setLastUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cached.cachedAt))); } catch {}
          appliedCache = true;
        }
        const res = await fetch(`/api/moods?from=${fromISO}&to=${toISO}`, { signal: ctrlRef.current.signal });
        const data: MoodItem[] = res.ok ? await res.json() : [];
        const valid = Array.isArray(data) ? data.filter((x) => typeof x?.score === 'number' && x?.date) : [];
        const normalized = valid.map((x) => ({ date: x.date.slice(0, 10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
        setItems(normalized);
        try { setCache(cacheKey, data); } catch {}
        setLastUpdatedMs((prev) => Math.max(prev ?? 0, Date.now()));
      } catch {
        if (!appliedCache) setItems([]);
      }
    }
    if (year) load();
  }, [year]);

  // Fetch day summary when a date is selected
  useEffect(() => {
    if (!selectedDate) return;
    setDaySummary('loading');
    const date = selectedDate;

    async function fetchSummary() {
      try {
        const [logsRes, activitiesRes, highlightRes, weightRes, climbRes] = await Promise.allSettled([
          fetch(`/api/logs?date=${date}`),
          fetch('/api/activities'),
          fetch(`/api/highlights?date=${date}`),
          fetch(`/api/weights?date=${date}`),
          fetch(`/api/climbing/logs?from=${date}&to=${date}`),
        ]);

        const logs = logsRes.status === 'fulfilled' && logsRes.value.ok ? await logsRes.value.json() : [];
        const activities = activitiesRes.status === 'fulfilled' && activitiesRes.value.ok ? await activitiesRes.value.json() : [];
        const highlightData = highlightRes.status === 'fulfilled' && highlightRes.value.ok ? await highlightRes.value.json() : {};
        const weightData = weightRes.status === 'fulfilled' && weightRes.value.ok ? await weightRes.value.json() : {};
        const climbData = climbRes.status === 'fulfilled' && climbRes.value.ok ? await climbRes.value.json() : [];

        const moodScore = items.find((it) => it.date === date)?.score ?? 5;

        setDaySummary({
          date,
          score: moodScore,
          logs: Array.isArray(logs) ? logs : [],
          activities: Array.isArray(activities) ? activities : [],
          highlight: typeof highlightData?.text === 'string' ? highlightData.text : '',
          weight: typeof weightData?.weight === 'number' ? weightData.weight : null,
          climbLogs: Array.isArray(climbData) ? climbData : [],
        });
      } catch {
        setDaySummary(null);
      }
    }

    fetchSummary();
  }, [selectedDate, items]);

  const days = useMemo(() => {
    const start = new Date(`${year}-01-01T00:00:00`);
    const end = new Date(`${year}-12-31T00:00:00`);
    const out: Array<{ dateISO: string; date: Date }> = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push({ dateISO: localISO(d), date: new Date(d) });
    }
    return out;
  }, [year]);

  const moodMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.date] = it.score;
    return m;
  }, [items]);

  const avgScore = useMemo(() => {
    if (items.length === 0) return 5;
    return items.reduce((s, it) => s + it.score, 0) / items.length;
  }, [items]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = now.getFullYear() - 4; y <= now.getFullYear() + 1; y++) ys.push(y);
    return ys;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mood Year</h2>
        <div className="flex items-center gap-2">
          <select className="input" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      {lastUpdatedMs ? (<div className="subtle text-xs">Updated at {new Date(lastUpdatedMs).toLocaleTimeString()}</div>) : null}

      <div className="mx-auto w-full max-w-[min(100%,72rem)] px-1 sm:px-2">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d, idx) => {
            const score = moodMap[d.dateISO];
            const emoji = typeof score === 'number' ? moodEmoji(score) : '';
            const isEmpty = !emoji;
            const base = 'relative flex items-center justify-center rounded-md cursor-pointer transition-transform active:scale-90';
            const size = isEmpty ? 'text-[0.75rem] sm:text-sm md:text-base' : 'text-xl sm:text-2xl';
            const isOddMonth = d.date.getMonth() % 2 === 1;
            const isFirstOfMonth = d.date.getDate() === 1;
            const monthLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.date.getMonth()];
            return (
              <div
                key={d.dateISO}
                title={`${d.date.toLocaleDateString()}${emoji ? ` — ${score}/10` : ''}`}
                aria-label={`${d.date.toLocaleDateString()}${emoji ? ` — ${score}/10` : ''}`}
                role="button"
                tabIndex={0}
                className={`${base} ${size} hover:ring-2 hover:ring-offset-1 focus-visible:ring-2 focus-visible:outline-none`}
                style={{
                  aspectRatio: '1 / 1',
                  background: !isEmpty ? moodBackground(score) : isOddMonth ? 'var(--surface-alt)' : undefined,
                  color: isEmpty ? 'var(--muted-foreground)' : undefined,
                }}
                onClick={() => setSelectedDate(d.dateISO)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDate(d.dateISO); }}
              >
                {isFirstOfMonth ? (
                  <span className="absolute left-1 top-1 text-[10px] sm:text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {monthLabel}
                  </span>
                ) : null}
                {emoji || idx}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day summary modal */}
      {selectedDate && daySummary !== null && (
        <DayModal
          summary={daySummary}
          avgScore={avgScore}
          moodItems={items}
          onClose={() => { setSelectedDate(null); setDaySummary(null); }}
        />
      )}
    </div>
  );
}
