'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { dayStatus, type ItemKey } from '@/lib/quickDay';
import { applyQueue, applyQueueItem, pruneDays } from '@/lib/quickApply';
import type { QuickPayload } from '@/lib/quickPayload';
import { getLastEmail, loadOutbox, loadSnapshot, saveSnapshot, setLastEmail } from '@/lib/quickStore';
import { localISO, localTodayISO, parseLocalDate, weekStartLocal } from '@/lib/date';
import type { TimeCategory } from '@/lib/types';
import { useOutbox } from './useOutbox';
import WeekStrip, { type StripDay } from './WeekStrip';
import DaySection from './DaySection';
import ItemSheet, { type SheetTarget } from './ItemSheet';
import type { QuestInfo, SaveSpec } from './editors/types';

function addDays(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  return localISO(d);
}

function dayLabel(date: string, yesterday: string): string {
  if (date === yesterday) return 'Yesterday';
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

const catKey = (email: string) => `quick:categories:${email.toLowerCase()}`;

export default function QuickBoard({ onFill }: { onFill?: (date: string) => void }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email?.toLowerCase() ?? '';
  // Until the session answers (or while offline), use the last signed-in email kept on this phone.
  const [lastEmail, setLast] = useState('');
  const email = sessionEmail || lastEmail;
  // Only a confirmed session may send or fetch. The saved email is just a way to draw the board early.
  const confirmed = status === 'authenticated' && sessionEmail !== '';
  const { queue, enqueue, persistOk } = useOutbox(email, confirmed);

  const [today, setToday] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [payload, setPayload] = useState<QuickPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [quests, setQuests] = useState<QuestInfo>({});

  const payloadRef = useRef<QuickPayload | null>(null);
  const queueRef = useRef(queue);
  const fetched = useRef<Set<string>>(new Set());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    setToday(localTodayISO());
    setLast(getLastEmail() ?? '');
  }, []);

  useEffect(() => {
    if (sessionEmail) setLastEmail(sessionEmail);
  }, [sessionEmail]);

  const show = useCallback(
    (next: QuickPayload) => {
      payloadRef.current = next;
      setPayload(next);
      if (email) saveSnapshot(email, pruneDays(next, localTodayISO()));
    },
    [email],
  );

  /** Load a date range from the server, keep older days, and put pending taps back on top. */
  const fetchRange = useCallback(
    async (from: string, to: string) => {
      const id = `${from}_${to}`;
      try {
        const res = await fetch(`/api/quick?from=${from}&to=${to}`);
        if (res.status === 401) return router.replace('/login');
        if (res.status === 403) return router.replace('/setup');
        if (!res.ok) throw new Error('bad status');
        const fresh = (await res.json()) as QuickPayload;
        const old = payloadRef.current;
        const merged: QuickPayload = { ...fresh, days: { ...(old?.days ?? {}), ...fresh.days } };
        show(applyQueue(merged, queueRef.current));
        fetched.current.add(id);
        setStale(false);
      } catch {
        setStale(true);
      }
    },
    [router, show],
  );

  // Draw from the phone first, then refresh.
  useEffect(() => {
    if (!email || !today) return;
    const snap = loadSnapshot(email);
    if (snap && snap.days) {
      const pending = loadOutbox(email);
      payloadRef.current = applyQueue(snap, pending);
      setPayload(payloadRef.current);
    } else {
      payloadRef.current = null;
      setPayload(null);
    }
  }, [email, today]);

  // Refresh from the server only once the session is confirmed.
  useEffect(() => {
    if (!confirmed || !today) return;
    const monday = localISO(weekStartLocal(parseLocalDate(today)));
    const from = monday === today ? addDays(today, -1) : monday;
    void fetchRange(from, today);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchRange(from, today);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [confirmed, today, fetchRange]);

  // Categories and side-quest names: small, fetched once. Categories are kept on the phone for offline use.
  useEffect(() => {
    if (!email || !today) return;
    try {
      const raw = window.localStorage.getItem(catKey(email));
      if (raw) setCategories(JSON.parse(raw) as TimeCategory[]);
    } catch { /* no storage */ }
    if (!confirmed) return;
    void fetch('/api/time/categories')
      .then((r) => (r.ok ? r.json() : null))
      .then((list: TimeCategory[] | null) => {
        if (!Array.isArray(list)) return;
        setCategories(list);
        try {
          window.localStorage.setItem(catKey(email), JSON.stringify(list));
        } catch { /* quota */ }
      })
      .catch(() => {});
    void fetch(`/api/sidequests?year=${today.slice(0, 4)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list: Array<{ id: string; title: string; unit?: string }> | null) => {
        if (!Array.isArray(list)) return;
        const map: QuestInfo = {};
        for (const q of list) map[q.id] = { title: q.title, unit: q.unit };
        setQuests(map);
      })
      .catch(() => {});
  }, [email, today, confirmed]);

  useEffect(() => {
    setSheet(null);
  }, [email]);

  const yesterday = today ? addDays(today, -1) : null;
  const other = selected && selected !== today ? selected : yesterday;

  function selectDay(date: string) {
    if (!today || !yesterday) return;
    if (date === today) {
      setSelected(yesterday);
      return;
    }
    setSelected(date);
    if (!payloadRef.current?.days[date]) {
      const from = localISO(weekStartLocal(parseLocalDate(date)));
      const id = `${from}_${date}`;
      if (!fetched.current.has(id)) {
        fetched.current.add(id);
        void fetchRange(from, date);
      }
    }
  }

  function save(specs: SaveSpec[]) {
    let next = payloadRef.current;
    for (const s of specs) {
      enqueue({ key: s.key, url: s.url, method: s.method, body: s.body });
      if (next) next = applyQueueItem(next, { key: s.key, body: s.body, state: 'pending' });
    }
    if (next) show(next);
    setSheet(null);
  }

  const queued = (key: string) => queue.find((q) => q.key === key)?.body;

  const stripDays: StripDay[] = today
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(localISO(weekStartLocal(parseLocalDate(today))), i);
        const day = payload?.days[date];
        if (!day || !payload) return { date, filled: null, total: null };
        const s = dayStatus(day, payload.ctx);
        return { date, filled: s.filled, total: s.total };
      })
    : [];

  const open = (date: string, key: ItemKey) => {
    if (email) setSheet({ date, key });
  };

  return (
    <main className="mx-auto w-full max-w-md space-y-3 pb-8">
      <WeekStrip days={stripDays} today={today} selected={other} onSelect={selectDay} />

      {!persistOk && (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-alt)' }} role="status">
          Saving on this device is off — keep this page open until the dots clear.
        </p>
      )}
      {stale && payload && (
        <p className="text-center text-xs muted" role="status">
          Could not refresh. Showing what is saved on this phone.
        </p>
      )}

      {today && other && (
        <>
          {payload ? (
            <>
              <DaySection date={other} label={dayLabel(other, yesterday ?? '')} payload={payload} queue={queue} onOpen={open} onFill={onFill} />
              <DaySection date={today} label="Today" payload={payload} queue={queue} onOpen={open} onFill={onFill} />
            </>
          ) : (
            <>
              <SkeletonDay label={dayLabel(other, yesterday ?? '')} />
              <SkeletonDay label="Today" />
            </>
          )}
        </>
      )}
      {(!today || !other) && (
        <>
          <SkeletonDay label="Yesterday" />
          <SkeletonDay label="Today" />
        </>
      )}

      {sheet && payload && (
        <ItemSheet
          key={`${sheet.date}:${sheet.key}`}
          target={sheet}
          dayLabel={sheet.date === today ? 'Today' : dayLabel(sheet.date, yesterday ?? '')}
          payload={payload}
          categories={categories}
          quests={quests}
          queued={queued}
          onSave={save}
          onClose={() => setSheet(null)}
        />
      )}
    </main>
  );
}

function SkeletonDay({ label }: { label: string }) {
  return (
    <section className="card p-3" aria-label={label}>
      <h2 className="text-sm font-semibold">{label}</h2>
      <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="min-h-[4.75rem] rounded-xl" style={{ background: 'var(--surface-alt)' }} />
        ))}
      </div>
    </section>
  );
}
