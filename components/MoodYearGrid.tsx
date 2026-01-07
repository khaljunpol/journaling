"use client";

import { useEffect, useMemo, useState, useRef } from 'react';

type MoodItem = { date: string; score: number };

function pad(n: number) { return String(n).padStart(2, '0'); }
function localISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function moodEmoji(s: number) {
  const map: Record<number, string> = {
    0: '😭', 1: '😢', 2: '☹️', 3: '🙁', 4: '😕',
    5: '😐', 6: '🙂', 7: '😊', 8: '😃', 9: '😁', 10: '🤩'
  };
  return map[Math.max(0, Math.min(10, Math.round(s)))] || '';
}

export default function MoodYearGrid() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [account, setAccount] = useState<string>('Alex');
  const [items, setItems] = useState<MoodItem[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);

  // Resolve account from cookie/localStorage and listen to changes
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

  // Fetch moods for the entire year
  useEffect(() => {
    async function load() {
      try {
        if (ctrlRef.current) ctrlRef.current.abort();
        ctrlRef.current = new AbortController();
        const fromISO = `${year}-01-01`;
        const toISO = `${year}-12-31`;
        const res = await fetch(`/api/moods?from=${fromISO}&to=${toISO}&account=${encodeURIComponent(account)}`, { signal: ctrlRef.current.signal });
        const data: MoodItem[] = res.ok ? await res.json() : [];
        const valid = Array.isArray(data) ? data.filter((x) => typeof x?.score === 'number' && x?.date) : [];
        // Normalize dates to local ISO for display consistency
        const normalized = valid.map((x) => ({ date: x.date.slice(0,10), score: Math.max(0, Math.min(10, Math.round(x.score))) }));
        setItems(normalized);
      } catch { setItems([]); }
    }
    if (account && year) load();
  }, [account, year]);

  // Build the list of dates in the year
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

  // Year selector options
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
          <select className="rounded border px-2 py-1" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[min(100%,72rem)] px-1 sm:px-2">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d, idx) => {
            const score = moodMap[d.dateISO];
            const emoji = typeof score === 'number' ? moodEmoji(score) : '';
            const dayIndex = idx; // continuous 0..365 index over the year
            const isEmpty = !emoji;
            const base = 'relative flex items-center justify-center rounded-md';
            const size = isEmpty ? 'text-[0.75rem] sm:text-sm md:text-base' : 'text-xl sm:text-2xl';
            const color = isEmpty ? 'text-neutral-400 dark:text-neutral-600' : '';
            const isOddMonth = d.date.getMonth() % 2 === 1;
            const monthBg = isOddMonth ? 'bg-neutral-50 dark:bg-neutral-900' : 'bg-transparent';
            const isFirstOfMonth = d.date.getDate() === 1;
            const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.date.getMonth()];
            return (
              <div
                key={d.dateISO}
                title={`${d.date.toLocaleDateString()}${emoji ? ` — ${score}/10` : ''}`}
                aria-label={`${d.date.toLocaleDateString()}${emoji ? ` — ${score}/10` : ''}`}
                className={`${base} ${size} ${color} ${monthBg}`}
                style={{ aspectRatio: '1 / 1' }}
              >
                {isFirstOfMonth ? (
                  <span className="absolute left-1 top-1 text-[10px] sm:text-xs font-medium text-neutral-500">
                    {monthLabel}
                  </span>
                ) : null}
                {emoji || dayIndex}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
