"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Sidequest, SidequestLog } from '@/lib/types';
import SidequestCard from '@/components/SidequestCard';
import SidequestForm from '@/components/SidequestForm';

type SidequestWithLogs = Sidequest & { logs: SidequestLog[] };

export default function SidequestsPage() {
  const [items, setItems] = useState<SidequestWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SidequestWithLogs | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

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
    await load();
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
    await load();
  }


  const filtered = items.filter((sq) => {
    if (filter === 'active') return !sq.completedAt;
    if (filter === 'done') return !!sq.completedAt;
    return true;
  });

  const activeCount = items.filter((s) => !s.completedAt).length;
  const doneCount = items.filter((s) => !!s.completedAt).length;

  return (
    <main className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Sidequests</h2>
          <p className="subtle text-sm mt-0.5">Personal goals &amp; challenges for {year}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <select
            className="rounded-md border px-2 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className="btn px-3 py-1.5 text-sm"
            onClick={() => { setEditItem(null); setShowForm(true); }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Create/Edit modal */}
      {(showForm || editItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div
            className="w-full max-w-lg rounded-xl border shadow-2xl p-6 overflow-y-auto max-h-[90vh]"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <h3 className="font-semibold text-lg mb-4">{editItem ? 'Edit sidequest' : 'New sidequest'}</h3>
            <SidequestForm
              initial={editItem || undefined}
              onSubmit={editItem ? handleEdit : handleCreate}
              onCancel={() => { setShowForm(false); setEditItem(null); }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      {!loading && items.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="card px-4 py-3 flex-1 min-w-[120px]">
            <div className="subtle text-xs uppercase tracking-wide">Active</div>
            <div className="text-2xl font-bold mt-1">{activeCount}</div>
          </div>
          <div className="card px-4 py-3 flex-1 min-w-[120px]">
            <div className="subtle text-xs uppercase tracking-wide">Completed</div>
            <div className="text-2xl font-bold mt-1">{doneCount}</div>
          </div>
          <div className="card px-4 py-3 flex-1 min-w-[120px]">
            <div className="subtle text-xs uppercase tracking-wide">Total</div>
            <div className="text-2xl font-bold mt-1">{items.length}</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="flex gap-1">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-md text-sm capitalize transition"
              style={{
                background: filter === f ? 'var(--surface-alt)' : 'transparent',
                color: filter === f ? 'var(--accent)' : 'var(--muted-foreground)',
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-16 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="card p-8 text-center space-y-3">
          <div className="text-3xl">🗡️</div>
          <div className="font-semibold">No sidequests yet</div>
          <p className="subtle text-sm">Add personal goals like weighted pull-ups, running records, or one-off challenges.</p>
          <button className="btn px-4 py-2 text-sm" onClick={() => setShowForm(true)}>
            Add your first sidequest
          </button>
        </div>
      )}

      {/* Cards grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
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
                await load();
              }}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && items.length > 0 && (
        <div className="subtle text-sm text-center py-4">
          No {filter} sidequests.{' '}
          <button className="underline" onClick={() => setFilter('all')}>Show all</button>
        </div>
      )}
    </main>
  );
}
