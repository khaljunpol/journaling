"use client";

import { getCache, setCache } from '@/lib/cache';
import { localISO } from '@/lib/date';
import { MOODS, moodBackground, moodColor, moodEmoji } from '@/lib/mood';
import { parseCookies } from '@/lib/apiHelpers';
import type { MoodItem } from '@/lib/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';

// ─── Day summary types ────────────────────────────────────────────────────────

type DaySummary = {
  date: string;
  score: number;
  logs: Array<{ activityId: string; completed: boolean }>;
  activities: Array<{ id: string; name: string }>;
  highlight: string;
  weight: number | null;
  climbLogs: Array<{ grade: string; type: string; attempts: number }>;
};

// ─── Insight generator ────────────────────────────────────────────────────────

function generateInsight(s: DaySummary, avgScore: number): string {
  const { score, logs, highlight, weight, climbLogs } = s;
  const done = logs.filter((l) => l.completed).length;
  const total = logs.length;
  const completion = total > 0 ? done / total : null;
  const moodDelta = score - avgScore;
  const label = moodLabel(score);
  const climbed = climbLogs.length > 0;

  const parts: string[] = [];

  // Mood vs average
  if (moodDelta >= 2) parts.push(`Mood was noticeably above your average — ${label.toLowerCase()} day.`);
  else if (moodDelta <= -2) parts.push(`Mood dipped below your average. ${score <= 3 ? 'Rough day.' : 'Off day.'}`);
  else parts.push(`Mood was close to your average — ${label.toLowerCase()}.`);

  // Activity completion
  if (completion === null) parts.push("No activities tracked.");
  else if (completion === 1) parts.push(total === 1 ? "Completed your one tracked activity." : `All ${total} activities completed.`);
  else if (completion >= 0.75) parts.push(`Strong day — ${done} of ${total} activities done.`);
  else if (completion >= 0.5) parts.push(`Half-and-half — ${done} of ${total} activities done.`);
  else if (completion > 0) parts.push(`Light day — only ${done} of ${total} activities completed.`);
  else parts.push("No activities checked off.");

  // Climbing
  if (climbed) {
    const grades = climbLogs.map((c) => c.grade.toUpperCase()).join(', ');
    const flashes = climbLogs.filter((c) => c.attempts === 0).length;
    if (flashes > 0) parts.push(`Climbed: ${grades}${flashes > 0 ? ` (${flashes} flash${flashes > 1 ? 'es' : ''})` : ''}.`);
    else parts.push(`Climbed: ${grades}.`);
  }

  // Weight note
  if (weight !== null) parts.push(`Logged weight: ${weight} kg.`);

  // Highlight snippet
  if (highlight && highlight.trim().length > 0) {
    const snippet = highlight.trim().length > 80 ? highlight.trim().slice(0, 77) + '…' : highlight.trim();
    parts.push(`"${snippet}"`);
  }

  return parts.join(' ');
}

function moodLabel(score: number): string {
  return MOODS.find((m) => m.score === score)?.label ?? String(score);
}

// ─── Day detail modal ─────────────────────────────────────────────────────────

function DayModal({
  summary,
  avgScore,
  onClose,
}: {
  summary: DaySummary | 'loading';
  avgScore: number;
  onClose: () => void;
}) {
  const dateLabel = summary === 'loading'
    ? '…'
    : new Date(summary.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Modal open onClose={onClose} size="md" mobileSheet className="!p-0 overflow-hidden">
        {summary === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6">
            <div className="text-3xl animate-pulse">🌀</div>
            <div className="subtle text-sm">Loading day summary…</div>
          </div>
        ) : (
          <DayModalContent summary={summary} avgScore={avgScore} dateLabel={dateLabel} />
        )}
    </Modal>
  );
}

function DayModalContent({
  summary,
  avgScore,
  dateLabel,
}: {
  summary: DaySummary;
  avgScore: number;
  dateLabel: string;
}) {
  const { score, logs, activities, highlight, weight, climbLogs } = summary;
  const emoji = moodEmoji(score);
  const label = moodLabel(score);
  const color = moodColor(score);
  const bg = moodBackground(score, 0.12);
  const completedLogs = logs.filter((l) => l.completed);
  const uncompletedLogs = logs.filter((l) => !l.completed);
  const actMap = Object.fromEntries(activities.map((a) => [a.id, a.name]));
  const insight = generateInsight(summary, avgScore);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: bg }}>
        <div className="subtle text-xs font-medium uppercase tracking-widest mb-1">{dateLabel}</div>
        <div className="flex items-center gap-3">
          <span className="text-5xl leading-none">{emoji}</span>
          <div>
            <div className="text-2xl font-bold" style={{ color }}>{score}<span className="text-base font-normal" style={{ color: 'var(--muted-foreground)' }}>/10</span></div>
            <div className="text-sm font-medium" style={{ color }}>{label}</div>
          </div>
        </div>
        {/* Mood bar */}
        <div className="mt-3 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(score / 10) * 100}%`, background: color }} />
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Insight */}
        <div className="rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: 'var(--surface-alt)', borderLeft: `3px solid ${color}` }}>
          {insight}
        </div>

        {/* Activities */}
        {logs.length > 0 && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Activities</div>
            <ul className="space-y-1.5">
              {completedLogs.map((l) => (
                <li key={l.activityId} className="flex items-center gap-2 text-sm">
                  <span className="text-base leading-none" style={{ color: '#22c55e' }}>✓</span>
                  <span>{actMap[l.activityId] ?? l.activityId}</span>
                </li>
              ))}
              {uncompletedLogs.map((l) => (
                <li key={l.activityId} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="text-base leading-none opacity-40">○</span>
                  <span>{actMap[l.activityId] ?? l.activityId}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Climbing */}
        {climbLogs.length > 0 && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Climbing</div>
            <ul className="space-y-1.5">
              {climbLogs.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-base">🧗</span>
                  <span className="font-medium">{c.grade.toUpperCase()}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>· {c.type}</span>
                  {c.attempts === 0
                    ? <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>Flash</span>
                    : <span style={{ color: 'var(--muted-foreground)' }}>· {c.attempts} att</span>
                  }
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Weight */}
        {weight !== null && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Weight</div>
            <div className="text-sm">{weight} kg</div>
          </section>
        )}

        {/* Highlight / journal */}
        {highlight && highlight.trim().length > 0 && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Highlight</div>
            <blockquote className="text-sm leading-relaxed italic" style={{ color: 'var(--foreground)', borderLeft: '2px solid var(--border)', paddingLeft: '0.75rem' }}>
              {highlight.trim()}
            </blockquote>
          </section>
        )}

        {/* Empty state */}
        {logs.length === 0 && climbLogs.length === 0 && weight === null && !highlight && (
          <div className="subtle text-sm text-center py-2">No activity data logged for this day.</div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MoodYearGrid() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [account, setAccount] = useState<string>('Alex');
  const [items, setItems] = useState<MoodItem[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);

  // Selected day state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummary | 'loading' | null>(null);

  // Resolve account from cookie/localStorage and listen to changes
  useEffect(() => {
    const cookieAccount = (() => {
      try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; }
    })();
    const init = cookieAccount || (typeof window !== 'undefined' ? localStorage.getItem('account') : null);
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    const onAccountChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const cookieAcc = (() => {
        try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; }
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

  // Fetch moods for the entire year
  useEffect(() => {
    async function load() {
      let appliedCache = false;
      try {
        if (ctrlRef.current) ctrlRef.current.abort();
        ctrlRef.current = new AbortController();
        const fromISO = `${year}-01-01`;
        const toISO = `${year}-12-31`;
        const cacheKey = `moods:year:${account}:${year}`;
        const cached = getCache<MoodItem[]>(cacheKey);
        if (cached) {
          const valid = Array.isArray(cached.data) ? cached.data.filter((x) => typeof x?.score === 'number' && x?.date) : [];
          const normalized = valid.map((x) => ({ date: x.date.slice(0, 10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
          setItems(normalized);
          try { setLastUpdatedMs((prev) => Math.max(prev ?? 0, Date.parse(cached.cachedAt))); } catch {}
          appliedCache = true;
        }
        const res = await fetch(`/api/moods?from=${fromISO}&to=${toISO}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal });
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
    if (account && year) load();
  }, [account, year]);

  // Fetch day summary when a date is selected
  useEffect(() => {
    if (!selectedDate) return;
    setDaySummary('loading');
    const acc = account;
    const date = selectedDate;

    async function fetchSummary() {
      try {
        const [logsRes, activitiesRes, highlightRes, weightRes, climbRes] = await Promise.allSettled([
          fetch(`/api/logs?date=${date}&account=${encodeURIComponent(acc)}`),
          fetch(`/api/activities?account=${encodeURIComponent(acc)}`),
          fetch(`/api/highlights?date=${date}&account=${encodeURIComponent(acc)}`),
          fetch(`/api/weights?date=${date}&account=${encodeURIComponent(acc)}`),
          fetch(`/api/climbing/logs?from=${date}&to=${date}&account=${encodeURIComponent(acc)}`),
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
  }, [selectedDate, account, items]);

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
          onClose={() => { setSelectedDate(null); setDaySummary(null); }}
        />
      )}
    </div>
  );
}
