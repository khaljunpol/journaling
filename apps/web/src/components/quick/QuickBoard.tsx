'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ListChecks } from 'lucide-react';
import { dayStatus, missingInOrder, type ItemKey } from '@/lib/quickDay';
import { syncState, type SyncState } from '@/lib/quickSync';
import { applyQueue, applyQueueItem, itemsForTile, pruneDays } from '@/lib/quickApply';
import type { CatchUpStep } from '@/lib/quickWeek';
import type { QuickPayload } from '@/lib/quickPayload';
import { getLastEmail, loadOutbox, loadSnapshot, loadWelcomeHidden, saveSnapshot, saveWelcomeHidden, setLastEmail } from '@/lib/quickStore';
import { showWelcome, welcomeSteps } from '@/lib/quickWelcome';
import { localISO, localTodayISO, parseLocalDate, weekStartLocal } from '@/lib/date';
import type { TimeCategory } from '@/lib/types';
import { useOutbox } from './useOutbox';
import { useWeek } from './useWeek';
import { useCatchUp } from './useCatchUp';
import WeekPanel from './WeekPanel';
import WelcomeCard from './WelcomeCard';
import WeekStrip, { type StripDay } from './WeekStrip';
import DaySection, { SkeletonDay } from './DaySection';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Sheet from '@/components/ui/Sheet';
import CardStack from './CardStack';
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

function shortLabel(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function weekTitle(monday: string, isCurrent: boolean, today: string | null): string {
  if (isCurrent) return 'This week';
  if (today && addDays(monday, 7) === localISO(weekStartLocal(parseLocalDate(today)))) return 'Last week';
  const f = (d: string) => parseLocalDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${f(monday)} – ${f(addDays(monday, 6))}`;
}

const catKey = (email: string) => `quick:categories:${email.toLowerCase()}`;

export default function QuickBoard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email?.toLowerCase() ?? '';
  // Until the session answers (or while offline), use the last signed-in email kept on this phone.
  const [lastEmail, setLast] = useState('');
  const email = sessionEmail || lastEmail;
  // Only a confirmed session may send or fetch. The saved email is just a way to draw the board early.
  const confirmed = status === 'authenticated' && sessionEmail !== '';
  const { queue, enqueue, discard, persistOk } = useOutbox(email, confirmed);

  const [today, setToday] = useState<string | null>(null);
  // Starts hidden so nobody sees it flash before this phone's choice is read.
  const [welcomeHidden, setWelcomeHidden] = useState(true);
  useEffect(() => {
    if (email) setWelcomeHidden(loadWelcomeHidden(email));
  }, [email]);
  // Dev only: /quick?welcome shows the card even with data, so it can be checked on a real account.
  const [previewWelcome, setPreviewWelcome] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') setPreviewWelcome(new URLSearchParams(window.location.search).has('welcome'));
  }, []);
  const [payload, setPayload] = useState<QuickPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [stack, setStack] = useState<{ steps: CatchUpStep[]; weekRun: boolean } | null>(null);
  const fillButton = useRef<HTMLElement | null>(null);
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [quests, setQuests] = useState<QuestInfo>({});

  const payloadRef = useRef<QuickPayload | null>(null);
  const queueRef = useRef(queue);

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
      try {
        const res = await fetch(`/api/quick?from=${from}&to=${to}`);
        if (res.status === 401) return router.replace('/login');
        if (res.status === 403) return router.replace('/setup');
        if (!res.ok) throw new Error('bad status');
        const fresh = (await res.json()) as QuickPayload;
        const old = payloadRef.current;
        const merged: QuickPayload = { ...fresh, days: { ...(old?.days ?? {}), ...fresh.days } };
        show(applyQueue(merged, queueRef.current));
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
    // Remove the history entry the stack pushed, so back does not need an extra press.
    if (window.history.state && window.history.state.quickStack) window.history.back();
    setStack(null);
  }, [email]);

  const week = useWeek(today, confirmed, fetchRange);

  // Overview links here with ?date=YYYY-MM-DD: open that day once. Read-only, saves nothing.
  const dateParamDone = useRef(false);
  useEffect(() => {
    if (!today || dateParamDone.current) return;
    dateParamDone.current = true;
    const d = new URLSearchParams(window.location.search).get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) week.goTo(d);
  }, [today, week]);
  const yesterday = today ? addDays(today, -1) : null;
  // Current week: the tapped day replaces Yesterday. Past week: the tapped day, else that Monday.
  const other = week.isCurrent ? (week.tapped && week.tapped !== today ? week.tapped : yesterday) : (week.tapped ?? week.shown);

  const cu = useCatchUp({
    email,
    today,
    yesterday,
    payload,
    payloadRef,
    shown: week.shown,
    dates: week.dates,
    commit: (specs) => commit(specs),
  });
  const onlyOf = cu.onlyOf;

  function selectDay(date: string) {
    if (today && yesterday) week.pick(date === today ? yesterday : date);
  }

  /** One save path for the sheet and the card stack: queue it and update the board right away. */
  function commit(specs: SaveSpec[]) {
    let next = payloadRef.current;
    for (const s of specs) {
      enqueue({ key: s.key, url: s.url, method: s.method, body: s.body });
      if (next) next = applyQueueItem(next, { key: s.key, body: s.body, state: 'pending' });
    }
    if (next) show(next);
  }

  function save(specs: SaveSpec[]) {
    commit(specs);
    setSheet(null);
  }

  function fill(date: string) {
    const p = payloadRef.current;
    const day = p?.days[date];
    if (!email || !p || !day) return;
    const steps = missingInOrder(dayStatus(day, p.ctx, { only: onlyOf(date) })).map((key) => ({ date, key }));
    if (steps.length === 0) return;
    openStack(steps, false);
  }

  function openStack(steps: CatchUpStep[], weekRun: boolean) {
    fillButton.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStack({ steps, weekRun });
  }

  function closeStack() {
    setStack(null);
    const el = fillButton.current;
    fillButton.current = null;
    window.setTimeout(() => {
      if (el && el.isConnected) el.focus();
    }, 0);
  }

  const queued = (key: string) => queue.find((q) => q.key === key)?.body;

  const stripDays: StripDay[] = today
    ? week.dates.map((date) => {
        const day = payload?.days[date];
        if (!day || !payload) return { date, filled: null, total: null };
        const s = dayStatus(day, payload.ctx, { only: onlyOf(date) });
        return { date, filled: s.filled, total: s.total };
      })
    : [];

  const open = (date: string, key: ItemKey) => {
    if (email) setSheet({ date, key });
  };

  // The Catch up Sheet is phone-only: close it if the window grows to the desktop layout.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (mq.matches) setMenu(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const sync = syncState(queue, persistOk);
  const dateLine = today ? parseLocalDate(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  const panel = payload && week.shown && (
    <WeekPanel
      key={week.shown}
      isCurrent={week.isCurrent}
      summary={cu.summary()}
      choice={cu.choice}
      chosen={cu.chosen}
      stepsLeft={cu.stepsFor(cu.choice).length}
      loaded={cu.loaded}
      message={cu.message}
      habitMessage={cu.habitMessage}
      onSaveChoice={cu.saveChoice}
      onCatchUp={(kinds) => {
        setMenu(false);
        openStack(cu.stepsFor(kinds), true);
      }}
      onFillHours={cu.fillHours}
      onFillHabits={cu.fillHabits}
      onToday={() => {
        setMenu(false);
        week.toToday();
      }}
    />
  );

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Today"
        context={dateLine}
        actions={
          <>
            <SyncDot state={sync} />
            <Button variant="ghost" small className="lg:hidden" onClick={() => setMenu(true)} disabled={!payload}>
              <ListChecks size={16} aria-hidden="true" />
              Catch up
            </Button>
          </>
        }
      />

      {!persistOk && (
        <p className="rounded-[10px] border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--warn)', color: 'var(--text-1)' }} role="status">
          Saving on this device is off. Keep this page open until the dots clear.
        </p>
      )}
      {stale && payload && (
        <p className="text-center text-[13px]" style={{ color: 'var(--text-2)' }} role="status">
          Could not refresh. Showing what is saved on this phone.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-4">
          {payload && today && (previewWelcome || showWelcome(payload, today, welcomeHidden)) && (
            <WelcomeCard
              steps={welcomeSteps(payload, today)}
              onHide={() => {
                setPreviewWelcome(false);
                setWelcomeHidden(true);
                if (email) saveWelcomeHidden(email);
              }}
            />
          )}
          <section className="card p-3 sm:p-4" aria-label="Week">
            <WeekStrip
              days={stripDays}
              today={today}
              selected={other}
              onSelect={selectDay}
              weekLabel={week.shown ? weekTitle(week.shown, week.isCurrent, today) : ''}
              canNext={week.canNext}
              onPrev={week.prev}
              onNext={week.next}
            />
          </section>

          {today && other ? (
            payload ? (
              <>
                {week.isCurrent && <DaySection date={today} label="Today" payload={payload} queue={queue} onOpen={open} onFill={fill} primary />}
                <DaySection date={other} label={dayLabel(other, yesterday ?? '')} payload={payload} queue={queue} onOpen={open} onFill={fill} only={onlyOf(other)} primary={!week.isCurrent} />
              </>
            ) : (
              <>
                {week.isCurrent && <SkeletonDay label="Today" />}
                <SkeletonDay label={dayLabel(other, yesterday ?? '')} />
              </>
            )
          ) : (
            <>
              <SkeletonDay label="Today" />
              <SkeletonDay label="Yesterday" />
            </>
          )}
        </div>

        {panel && (
          <aside className="card hidden space-y-3 p-5 lg:sticky lg:top-6 lg:block">
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>Catch up</h2>
            {panel}
          </aside>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Catch up">
        {panel}
      </Sheet>

      {stack && payload && (
        <CardStack
          key={`${stack.weekRun}:${stack.steps[0]?.date}`}
          steps={stack.steps}
          weekRun={stack.weekRun}
          labelFor={(d) => (stack.weekRun ? shortLabel(d) : d === today ? 'Today' : dayLabel(d, yesterday ?? ''))}
          today={today}
          yesterday={yesterday ?? null}
          payload={payload}
          categories={categories}
          quests={quests}
          queued={queued}
          onSave={commit}
          onClose={closeStack}
        />
      )}

      {sheet && payload && (
        <ItemSheet
          key={`${sheet.date}:${sheet.key}`}
          target={sheet}
          today={today}
          yesterday={yesterday ?? null}
          payload={payload}
          categories={categories}
          quests={quests}
          queued={queued}
          onSave={save}
          onClose={() => setSheet(null)}
          failedKeys={itemsForTile(queue, sheet.key, sheet.date).filter((q) => q.state === 'failed').map((q) => q.key)}
          onDiscard={(keys) => {
            discard(keys);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

const SYNC: Record<SyncState, { color: string; label: string }> = {
  saved: { color: 'var(--ok)', label: 'Saved' },
  saving: { color: 'var(--sync)', label: 'Saving' },
  failed: { color: 'var(--warn)', label: 'Not saved' },
};

function SyncDot({ state }: { state: SyncState }) {
  const s = SYNC[state];
  return (
    <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-2)' }} role="status">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state === 'saving' ? 'sync-pulse' : ''}`} style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
