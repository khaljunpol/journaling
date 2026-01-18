"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import ActivityCalendar from '@/components/ActivityCalendar';
import DailyHighlight from '@/components/DailyHighlight';
import DailyWeight from '@/components/DailyWeight';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function JournalView() {
  const today = useMemo(() => localTodayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [account, setAccount] = useState<string>('Alex');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const moods: Array<{ score: number; emoji: string; label: string }> = [
    { score: 0, emoji: '😭', label: 'Terrible' },
    { score: 1, emoji: '😢', label: 'Very Bad' },
    { score: 2, emoji: '☹️', label: 'Bad' },
    { score: 3, emoji: '🙁', label: 'Down' },
    { score: 4, emoji: '😕', label: 'Meh' },
    { score: 5, emoji: '😐', label: 'Neutral' },
    { score: 6, emoji: '🙂', label: 'Okay' },
    { score: 7, emoji: '😊', label: 'Good' },
    { score: 8, emoji: '😃', label: 'Great' },
    { score: 9, emoji: '😁', label: 'Awesome' },
    { score: 10, emoji: '🤩', label: 'Excellent' },
  ];

  const moodCtrlRef = useRef<AbortController | null>(null);

  

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

  async function fetchMood() {
    try {
      if (moodCtrlRef.current) moodCtrlRef.current.abort();
      moodCtrlRef.current = new AbortController();
      const res = await fetch(`/api/moods?date=${selectedDate}&account=${encodeURIComponent(account)}`, { signal: moodCtrlRef.current.signal });
      if (!res.ok) { setMoodScore(null); return; }
      const data = await res.json();
      setMoodScore(typeof data?.score === 'number' ? data.score : null);
    } catch { setMoodScore(null); }
  }

  useEffect(() => { fetchMood(); }, [selectedDate, account]);

  

  async function setMood(score: number) {
    try {
      const res = await fetch(`/api/moods?account=${encodeURIComponent(account)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, score })
      });
      if (!res.ok) return;
      setMoodScore(score);
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 card p-4">
        <div className="text-lg font-medium">
          {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="w-full sm:w-auto overflow-x-auto max-w-full">
          <div className="flex items-center gap-2 px-2 whitespace-nowrap">
            <button
            className="shrink-0 btn-outline"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }}
          >
            Previous
          </button>
          <button
            className="shrink-0 btn-outline"
            onClick={() => setSelectedDate(localTodayISO())}
          >
            Today
          </button>
          <input
            type="date"
            className="shrink-0 input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            className="shrink-0 btn-outline"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }}
          >
            Next
          </button>
          </div>
        </div>
      </div>

      <ActivityCalendar selectedDateISO={selectedDate} onSelectDate={setSelectedDate} />
      <div className="card p-4">
        <div className="card-title">How are you feeling today?</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m.score}
              className={`btn-outline text-xl px-3 py-2 ${moodScore === m.score ? '' : ''}`}
              style={moodScore === m.score ? { boxShadow: '0 0 0 3px var(--ring)' } : undefined}
              title={`${m.label} (${m.score}/10)`}
              onClick={() => setMood(m.score)}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        <div className="mt-2 subtle">Selected: {typeof moodScore === 'number' ? `${moodScore}/10` : '—'}</div>
      </div>
      <DailyHighlight dateISO={selectedDate} />
      <DailyWeight dateISO={selectedDate} />
      
    </div>
  );
}
