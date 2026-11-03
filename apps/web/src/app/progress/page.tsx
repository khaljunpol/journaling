"use client";

import { useCallback, useEffect, useState, Suspense } from 'react';
import type { Sidequest, SidequestLog } from '@journaling/core/types';
import SidequestCard from '@/components/SidequestCard';
import Badges from '@/components/game/Badges';
import LevelCard from '@/components/game/LevelCard';
import StreakCard from '@/components/game/StreakCard';
import StreakShareSheet from '@/components/game/StreakShareSheet';
import type { Streak } from '@journaling/core/streaks';
import { useGame } from '@/components/game/useGame';
import SidequestForm from '@/components/SidequestForm';
import { localTodayISO } from '@journaling/core/date';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import Skeleton from '@/components/ui/Skeleton';
import Tabs, { useRouteTab } from '@/components/ui/Tabs';

type SidequestWithLogs = Sidequest & { logs: SidequestLog[] };

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
] as const;

function ProgressView() {
  const [items, setItems] = useState<SidequestWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SidequestWithLogs | null>(null);
  const filter = useRouteTab(TABS);
  const game = useGame();
  const [sharing, setSharing] = useState<Streak | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sidequests?year=${year}&logs=true`);
      if (!res.ok) throw new Error('Failed to load');
      const data: SidequestWithLogs[] = await res.json();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // Refresh a single item in state without full reload
  async function refreshItem(id: string) {
    const res = await fetch(`/api/sidequests/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setItems((prev) => prev.map((s) => s.id === id ? { ...d, logs: d.logs || [] } : s));
  }

  async function handleCreate(data: Partial<Sidequest>) {
    const res = await fetch('/api/sidequests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, year }),
    });
    if (!res.ok) throw new Error('Failed to create');
    setShowForm(false);
    await load();
  }

  async function handleEdit(data: Partial<Sidequest>) {
    if (!editItem) return;
    const res = await fetch(`/api/sidequests/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update');
    setEditItem(null);
    await refreshItem(editItem.id);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sidequests/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleLog(id: string, data: Partial<SidequestLog>) {
    const res = await fetch(`/api/sidequests/${id}?action=log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to log');
    await refreshItem(id);
  }


  const filtered = items.filter((sq) => {
    if (filter === 'active') return !sq.completedAt;
    if (filter === 'done') return !!sq.completedAt;
    return true;
  });

  const activeCount = items.filter((s) => !s.completedAt).length;
  const doneCount = items.filter((s) => !!s.completedAt).length;
  const monthPrefix = localTodayISO().slice(0, 7);
  const logsThisMonth = items.reduce((n, sq) => n + sq.logs.filter((l) => l.date?.startsWith(monthPrefix)).length, 0);

  const formOpen = showForm || editItem !== null;
  function closeForm() { setShowForm(false); setEditItem(null); }

  const emptyCopy: Record<string, string> = {
    active: 'Nothing active right now. Start one when you feel like it.',
    done: 'Nothing finished yet. Each log counts toward it.',
    all: 'No sidequests yet.',
  };

  return (
    <div className="space-y-4 pb-8 lg:space-y-6">
      <PageHeader
        title="Progress"
        context={`Personal goals and challenges for ${year}`}
        actions={
          <>
            <Select aria-label="Year" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Button onClick={() => { setEditItem(null); setShowForm(true); }}>New sidequest</Button>
          </>
        }
      />

      <Sheet open={formOpen} onClose={closeForm} title={editItem ? 'Edit sidequest' : 'New sidequest'}>
        <SidequestForm
          initial={editItem || undefined}
          onSubmit={editItem ? handleEdit : handleCreate}
          onCancel={closeForm}
        />
      </Sheet>

      {/* The game: level, streaks, badges. Phone: stacked. Desktop: level 2 columns, streaks 1. */}
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="lg:col-span-2"><LevelCard game={game} /></div>
        {game.state ? <StreakCard streaks={game.state.streaks} onShare={setSharing} /> : null}
        {game.state ? <div className="lg:col-span-3"><Badges badges={game.state.badges} next={game.state.next} /></div> : null}
      </div>

      <StreakShareSheet streak={sharing} level={game.numbers?.level ?? 1} bad={false} onClose={() => setSharing(null)} />

      <h2 className="pt-2 text-[15px] font-medium" style={{ color: 'var(--text-1)' }}>Sidequests</h2>
      {loading ? <Skeleton className="h-5 w-64" /> : (
        <p className="num -mt-2 text-[14px]" style={{ color: 'var(--text-2)' }}>
          {activeCount} active · {doneCount} done in {year} · {logsThisMonth} {logsThisMonth === 1 ? 'log' : 'logs'} this month
        </p>
      )}

      <Tabs tabs={TABS} label="Sidequest filter" />

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card space-y-3 p-4 sm:p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title={emptyCopy[filter]}
          hint={items.length === 0 ? 'Add a goal like weighted pull-ups, a running record, or a one-off challenge.' : undefined}
          action={<Button onClick={() => { setEditItem(null); setShowForm(true); }}>{items.length === 0 ? 'Add your first sidequest' : 'New sidequest'}</Button>}
        />
      )}

      {!loading && filtered.length > 0 && (
        <div id={`panel-${filter}`} role="tabpanel" aria-labelledby={`tab-${filter}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {filtered.map((sq) => (
            <SidequestCard
              key={sq.id}
              sidequest={sq}
              logs={sq.logs}
              onLog={(data) => handleLog(sq.id, data)}
              onDelete={() => handleDelete(sq.id)}
              onEdit={() => setEditItem(sq)}
              onUpdate={async (patch) => {
                await fetch(`/api/sidequests/${sq.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(patch),
                });
                await refreshItem(sq.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={null}>
      <ProgressView />
    </Suspense>
  );
}
