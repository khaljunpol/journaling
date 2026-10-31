"use client";

import { getCache, setCache } from '@/lib/cache';
import { localISO } from '@journaling/core/date';
import { MOODS, moodBackground, moodColor, moodEmoji } from '@journaling/core/mood';
import type { MoodItem, DaySummary } from '@/lib/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import Heatmap from '@/components/overview/Heatmap';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';

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
            <div className="text-3xl motion-safe:animate-pulse">...</div>
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
  const diffColor = diff >= 1 ? 'var(--ok)' : 'var(--text-2)'; // no red: a low day is not a failure

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
                  className="w-3 rounded-full"
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
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Habits</div>
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
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Habits</div>
            <div className="flex flex-wrap gap-1.5">
              {completedLogs.map((l) => (
                <span key={l.activityId} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
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
                  {c.attempts === 0 && <span style={{ color: 'var(--ok)' }}>Flash</span>}
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
            <blockquote className="rounded-[10px] px-3 py-2 text-sm leading-relaxed" style={{ background: 'var(--surface-2)' }}>
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

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function MoodYearGrid() {
  const now = new Date();
  const today = useMemo(() => localISO(new Date()), []);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [items, setItems] = useState<MoodItem[] | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // Tapped day (small panel) and the day opened in the detail modal.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummary | 'loading' | null>(null);

  useEffect(() => {
    async function load() {
      let appliedCache = false;
      try {
        if (ctrlRef.current) ctrlRef.current.abort();
        ctrlRef.current = new AbortController();
        const cacheKey = `moods:year:${year}`;
        const normalize = (data: MoodItem[]) =>
          (Array.isArray(data) ? data : [])
            .filter((x) => typeof x?.score === 'number' && x?.date)
            .map((x) => ({ date: x.date.slice(0, 10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
        const cached = getCache<MoodItem[]>(cacheKey);
        if (cached) { setItems(normalize(cached.data)); appliedCache = true; }
        const res = await fetch(`/api/moods?from=${year}-01-01&to=${year}-12-31`, { signal: ctrlRef.current.signal });
        const data: MoodItem[] = res.ok ? await res.json() : [];
        setItems(normalize(data));
        try { setCache(cacheKey, data); } catch { /* cache is optional */ }
      } catch {
        if (!appliedCache) setItems([]);
      }
    }
    if (year) load();
  }, [year]);

  useEffect(() => {
    if (!detailDate) return;
    setDaySummary('loading');
    const date = detailDate;
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
        const moodScore = (items ?? []).find((it) => it.date === date)?.score ?? 5;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailDate]);

  const moodMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items ?? []) m[it.date] = it.score;
    return m;
  }, [items]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const avg = list.length ? list.reduce((s, it) => s + it.score, 0) / list.length : 5;
    const months = Array.from({ length: 12 }, (_, m) => {
      const inMonth = list.filter((it) => Number(it.date.slice(5, 7)) - 1 === m);
      return { m, n: inMonth.length, avg: inMonth.length ? inMonth.reduce((s, it) => s + it.score, 0) / inMonth.length : null };
    });
    const spread = MOODS.map((d) => ({ ...d, n: list.filter((it) => it.score === d.score).length }));
    const top = spread.reduce((a, b) => (b.n > a.n ? b : a), spread[0]);
    return { avg, months, spread, top, count: list.length };
  }, [items]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = now.getFullYear() - 4; y <= now.getFullYear() + 1; y++) ys.push(y);
    return ys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const picked = selectedDate && moodMap[selectedDate] !== undefined ? moodMap[selectedDate] : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardHeader
          title={`Mood in ${year}`}
          meta={items && <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{stats.count} days logged</span>}
          actions={
            <Select aria-label="Year" value={year} onChange={(e) => { setYear(parseInt(e.target.value, 10)); setSelectedDate(null); }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          }
        />
        {items === null ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="min-w-[680px] sm:min-w-0">
                <Heatmap year={year} moods={moodMap} today={today} selected={selectedDate} onSelect={setSelectedDate} />
              </div>
            </div>
            <div className="mt-2 flex min-h-14 items-center gap-3 rounded-[10px] px-3 py-1" style={{ background: 'var(--surface-2)' }} aria-live="polite">
              {selectedDate ? (
                <>
                  <span className="text-[28px] leading-none" aria-hidden="true">{picked !== null ? moodEmoji(picked) : '·'}</span>
                  <div className="min-w-0 flex-1 text-[14px]">
                    <div style={{ color: 'var(--text-1)' }}>
                      {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="num text-[13px]" style={{ color: 'var(--text-2)' }}>
                      {picked !== null ? `${moodLabel(picked)} · ${picked}/10` : 'No mood logged'}
                    </div>
                  </div>
                  <Button small variant="outline" onClick={() => setDetailDate(selectedDate)}>Day details</Button>
                </>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Tap a square to see that day. Scroll sideways on a phone.</p>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Month averages" meta={items && <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>avg {stats.avg.toFixed(1)}</span>} />
        {items === null ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <ol className="grid grid-cols-12 gap-1" aria-label="Average mood per month">
              {stats.months.map((mo) => (
                <li key={mo.m} className="flex flex-col items-center gap-1" aria-label={`${MONTH_INITIALS[mo.m]}: ${mo.avg === null ? 'no data' : mo.avg.toFixed(1)}`}>
                  <span className="num text-[11px]" style={{ color: 'var(--text-2)' }}>{mo.avg === null ? '–' : mo.avg.toFixed(1)}</span>
                  <span className="relative block h-16 w-full overflow-hidden rounded-[6px]" style={{ background: 'var(--surface-3)' }}>
                    {mo.avg !== null && (
                      <span className="absolute inset-x-0 bottom-0 block rounded-[6px]" style={{ height: `${(mo.avg / 10) * 100}%`, background: moodColor(mo.avg) }} />
                    )}
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{MONTH_INITIALS[mo.m]}</span>
                </li>
              ))}
            </ol>
            {stats.count > 0 && (
              <div className="mt-3">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }} role="img" aria-label={`Mood spread. Most common: ${stats.top.label}, ${stats.top.n} days`}>
                  {stats.spread.filter((s) => s.n > 0).map((s) => (
                    <span key={s.score} style={{ width: `${(s.n / stats.count) * 100}%`, background: s.color }} />
                  ))}
                </div>
                <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  Spread: most days were {stats.top.emoji} {stats.top.label.toLowerCase()} ({stats.top.n}).
                </p>
              </div>
            )}
          </>
        )}
      </Card>

      {detailDate && daySummary !== null && (
        <DayModal
          summary={daySummary}
          avgScore={stats.avg}
          moodItems={items ?? []}
          onClose={() => { setDetailDate(null); setDaySummary(null); }}
        />
      )}
    </div>
  );
}
