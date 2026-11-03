"use client";

import { useEffect, useRef, useState } from 'react';
import { categoryOf, type HabitCategory } from '@journaling/core/habitCategory';
import type { Activity } from '@journaling/core/types';
import CategorySelect from '@/components/settings/CategorySelect';
import SortHabitsSheet from '@/components/settings/SortHabitsSheet';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input from '@/components/ui/Input';

export default function ActivityList() {
  const [items, setItems] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const fetchVersionRef = useRef(0);
  const actsCtrlRef = useRef<AbortController | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // Delete takes two taps: the first one asks, in the row itself.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Unknown until the settings load; a failed read keeps the prompt hidden.
  const [needsSort, setNeedsSort] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }

  async function refresh() {
    const v = ++fetchVersionRef.current;
    try {
      if (actsCtrlRef.current) actsCtrlRef.current.abort();
      actsCtrlRef.current = new AbortController();
      const res = await fetch('/api/activities', { signal: actsCtrlRef.current.signal });
      if (!res.ok) { if (v === fetchVersionRef.current) setItems([]); return; }
      const data = await res.json();
      const arr: Activity[] = Array.isArray(data) ? (data as Activity[]) : [];
      if (v === fetchVersionRef.current) setItems(arr);
    } catch {
      if (v === fetchVersionRef.current) setItems([]);
    }
  }

  useEffect(() => {
    if (actsCtrlRef.current) actsCtrlRef.current.abort();
    setItems([]);
    refresh();
    let alive = true;
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => { if (alive && s) setNeedsSort(!s.habitCategoriesConfirmed); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  async function add() {
    const nm = name.trim();
    if (!nm) return;
    const res = await fetch('/api/activities', { method: 'POST', body: JSON.stringify({ name: nm }), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return;
    setName('');
    showToast(`"${nm}" added`);
    refresh();
  }

  async function updateName(id: string, newName: string) {
    await fetch(`/api/activities/${id}`, { method: 'PATCH', body: JSON.stringify({ name: newName }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function setCategory(a: Activity, category: HabitCategory) {
    const failed = () => {
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, category: a.category } : x)));
      showToast("Couldn't save. Try again.");
    };
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, category } : x)));
    try {
      const res = await fetch(`/api/activities/${a.id}`, { method: 'PATCH', body: JSON.stringify({ category }), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) failed();
    } catch {
      failed();
    }
  }

  async function remove(a: Activity) {
    setConfirmId(null);
    const res = await fetch(`/api/activities/${a.id}`, { method: 'DELETE' });
    showToast(res.ok ? `"${a.name}" deleted` : "Couldn't delete. Try again.");
    refresh();
  }

  function startEdit(a: Activity) {
    setEditingId(a.id);
    setEditName(a.name);
  }

  function saveEdit(id: string) {
    const trimmed = editName.trim();
    if (trimmed) updateName(id, trimmed);
    setEditingId(null);
  }

  const rowClass = 'flex items-center justify-between gap-3 rounded-[10px] px-4 py-3';
  const bar = (color: string) => <div className="h-5 w-1 rounded-full" style={{ background: color }} />;

  return (
    <section className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[14px] font-medium lg:bottom-6"
          style={{ background: 'var(--accent-fill)', color: 'var(--on-accent-fill)', boxShadow: 'var(--shadow-pop)' }}
        >
          {toast}
        </div>
      )}

      <h2 className="text-[20px] font-semibold" style={{ color: 'var(--text-1)' }}>Habits</h2>

      {needsSort && items.length > 0 ? (
        <button type="button" className="press block min-h-11 text-left text-[14px]" style={{ color: 'var(--text-2)' }} onClick={() => setSortOpen(true)}>
          Sort your habits into groups ›
        </button>
      ) : null}

      {/* Add */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          {bar('var(--accent)')}
          <span className="text-[14px] font-medium">Add habit</span>
        </div>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            aria-label="Habit name"
            placeholder="Habit name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button onClick={add} disabled={!name.trim()}>Add</Button>
        </div>
      </Card>

      {/* Habits */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          {bar('var(--ok)')}
          <span className="text-[14px] font-medium">Tracking</span>
          <Chip>{items.length}</Chip>
        </div>
        {items.length === 0 && <div className="text-[14px]" style={{ color: 'var(--text-2)' }}>No habits yet.</div>}
        <div className="space-y-2">
          {items.map((a) => confirmId === a.id ? (
            <div key={a.id} className={`${rowClass} flex-wrap`} style={{ background: 'var(--surface-2)', border: '1px solid var(--warn)' }} role="alertdialog" aria-label={`Delete ${a.name}?`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>Delete &quot;{a.name}&quot;?</p>
                <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Its ticks stay in your sheet but stop showing.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="ghost" small onClick={() => setConfirmId(null)} autoFocus>Keep</Button>
                <Button variant="outline" small onClick={() => remove(a)}>Delete</Button>
              </div>
            </div>
          ) : (
            <div key={a.id} className={rowClass} style={{ background: 'var(--surface-2)' }}>
              <div className="min-w-0 flex-1">
                {editingId === a.id ? (
                  <Input
                    className="min-w-0"
                    aria-label="Habit name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a.id); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={() => saveEdit(a.id)}
                    autoFocus
                  />
                ) : (
                  <button type="button" className="block min-h-11 w-full truncate text-left text-[14px] font-medium" onClick={() => startEdit(a)}>
                    {a.name}
                  </button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <CategorySelect value={categoryOf(a)} label={a.name} onChange={(c) => setCategory(a, c)} />
                <Button variant="ghost" small onClick={() => setConfirmId(a.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SortHabitsSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        habits={items}
        onSaved={() => { setNeedsSort(false); showToast('Habits sorted'); refresh(); }}
      />
    </section>
  );
}
