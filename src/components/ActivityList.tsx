"use client";

import { useEffect, useRef, useState } from 'react';
import type { Activity } from '@/lib/types';
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

  async function remove(id: string) {
    await fetch(`/api/activities/${id}`, { method: 'DELETE' });
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
          {items.map((a) => (
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
                <Button variant="ghost" small onClick={() => remove(a.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </section>
  );
}
