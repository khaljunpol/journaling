"use client";

import ActivityCalendar from '@/components/ActivityCalendarClient';
import DailyHighlight from '@/components/DailyHighlightClient';
import DailyWeight from '@/components/DailyWeightClient';
import { getCache, setCache } from '@/lib/cache';
import { localTodayISO, pad } from '@/lib/date';
import { MOODS } from '@/lib/mood';
import { parseCookies } from '@/lib/apiHelpers';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

function stepDate(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function JournalView() {
  const today = useMemo(() => localTodayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isPending, startTransition] = useTransition();
  const [account, setAccount] = useState<string>('Alex');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const moodCtrlRef = useRef<AbortController | null>(null);

  const isToday = selectedDate === today;

  const displayDate = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return {
      weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
      full: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    };
  }, [selectedDate]);

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
      setAccount(detail || cookieAcc || localStorage.getItem('account') || 'Alex');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('account-change', onAccountChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('account-change', onAccountChange as EventListener);
    };
  }, []);

  useEffect(() => {
    async function fetchMood() {
      try {
        const cacheKey = `mood:${account}:${selectedDate}`;
        const cached = getCache<{ score: number | null }>(cacheKey);
        if (cached && typeof cached.data?.score === 'number') setMoodScore(cached.data.score);
        if (moodCtrlRef.current) moodCtrlRef.current.abort();
        moodCtrlRef.current = new AbortController();
        const res = await fetch(`/api/moods?date=${selectedDate}&account=${encodeURIComponent(account)}`, { signal: moodCtrlRef.current.signal });
        if (!res.ok) return;
        const data = await res.json();
        const score = typeof data?.score === 'number' ? data.score : null;
        setMoodScore(score);
        setCache(cacheKey, { score });
      } catch { /* ignore */ }
    }
    fetchMood();
  }, [selectedDate, account]);

  async function saveMood(score: number) {
    const prev = moodScore;
    setMoodScore(score);
    try { setCache(`mood:${account}:${selectedDate}`, { score }); } catch {}
    try {
      const res = await fetch(`/api/moods?account=${encodeURIComponent(account)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, score }),
      });
      if (!res.ok) { setMoodScore(prev); }
    } catch { setMoodScore(prev); }
  }

  const selectedMood = MOODS.find((m) => m.score === moodScore);

  return (
    <div className="space-y-6 overflow-x-hidden">

      {/* ── Date navigation ────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <div className="flex items-center gap-4">
          <button
            aria-label="Previous day"
            disabled={isPending}
            onClick={() => startTransition(() => setSelectedDate(stepDate(selectedDate, -1)))}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:scale-95"
            style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
          >
            ←
          </button>

          <div className="text-center min-w-[160px]">
            <div className="text-2xl font-semibold tracking-tight">{displayDate.weekday}</div>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {displayDate.full}
              {isToday && <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--accent)' }}>Today</span>}
            </div>
          </div>

          <button
            aria-label="Next day"
            disabled={isPending}
            onClick={() => startTransition(() => setSelectedDate(stepDate(selectedDate, 1)))}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:scale-95"
            style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={() => startTransition(() => setSelectedDate(today))}
              className="text-xs px-3 py-1 rounded-full border transition-colors active:scale-95"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'transparent' }}
            >
              Jump to today
            </button>
          )}
          <input
            type="date"
            className="text-xs rounded-full border px-3 py-1 outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--muted-foreground)' }}
            value={selectedDate}
            onChange={(e) => startTransition(() => setSelectedDate(e.target.value))}
          />
        </div>
      </div>

      {/* ── Mood + Weight row — grouped as "How's today?" ── */}
      <div className="card p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">How are you feeling?</h2>
          {selectedMood && (
            <span className="text-sm font-medium transition-all" style={{ color: selectedMood.color }}>
              {selectedMood.emoji} {selectedMood.label}
            </span>
          )}
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
          {MOODS.map((m) => {
            const isSelected = moodScore === m.score;
            return (
              <button
                key={m.score}
                title={`${m.label} (${m.score}/10)`}
                onClick={() => saveMood(m.score)}
                className="relative flex items-center justify-center rounded-xl transition-all aspect-square"
                style={{
                  fontSize: 22,
                  background: isSelected ? `${m.color}33` : `${m.color}11`,
                  boxShadow: isSelected ? `0 0 0 2px ${m.color}` : undefined,
                  transform: isSelected ? 'scale(1.08)' : undefined,
                }}
              >
                {m.emoji}
              </button>
            );
          })}
        </div>

        {/* Weight inline */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <DailyWeight dateISO={selectedDate} />
        </div>
      </div>

      {/* ── Activity calendar ───────────────────────────────── */}
      <div>
        <ActivityCalendar
          selectedDateISO={selectedDate}
          onSelectDate={(d) => startTransition(() => setSelectedDate(d))}
        />
        {isPending && <div className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>Updating…</div>}
      </div>

      {/* ── Highlight ───────────────────────────────────────── */}
      <DailyHighlight dateISO={selectedDate} />

    </div>
  );
}
