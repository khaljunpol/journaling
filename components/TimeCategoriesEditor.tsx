"use client";

import { useEffect, useRef, useState } from 'react';
import type { TimeCategory as Category } from '@/lib/types';

export default function TimeCategoriesEditor() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#888888');
  const [isSaving, setIsSaving] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      const controller = new AbortController();
      ctrlRef.current = controller;
      const res = await fetch('/api/time/categories', { signal: controller.signal });
      if (!res.ok) { setItems([]); return; }
      const list: Category[] = await res.json();
      setItems(list || []);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setItems([]);
    }
  }

  useEffect(() => { refresh(); }, []);

  function updateItem(id: string, patch: Partial<Category>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function saveNew() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const order = (items?.length || 0) + 1;
      const res = await fetch('/api/time/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed, color, order }) });
      if (res.ok) {
        setName(''); setColor('#888888');
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(it: Category, patch: Partial<Category>) {
    setIsSaving(true);
    try {
      const res = await fetch('/api/time/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, name: patch.name ?? it.name, color: patch.color ?? it.color, order: patch.order ?? it.order }) });
      if (res.ok) refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(it: Category) {
    if (!confirm(`Delete category "${it.name}"?`)) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/time/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id }) });
      if (res.ok) refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function move(it: Category, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === it.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const other = sorted[targetIdx];
    saveEdit(it, { order: other.order });
    saveEdit(other, { order: it.order });
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Time Categories</h2>
        <a href="/time" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted-foreground)' }}>Back to Time</a>
      </div>

      {/* Add */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm">Add Category</span>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Name</label>
            <input className="input w-full" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNew()} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Color</label>
            <input className="input h-10 w-12 p-1 cursor-pointer" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <button className="btn h-10" onClick={saveNew} disabled={isSaving || !name.trim()}>Add</button>
        </div>
      </div>

      {/* List */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm">Categories</span>
          <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }}>{sorted.length}</span>
        </div>
        {sorted.length === 0 && <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No categories yet.</div>}
        <div className="space-y-2">
          {sorted.map((it, i) => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-alt)' }}>
              <input
                className="h-8 w-8 rounded-lg p-0.5 cursor-pointer shrink-0"
                type="color"
                value={it.color}
                style={{ border: '2px solid var(--border)' }}
                onInput={(e) => updateItem(it.id, { color: (e.target as HTMLInputElement).value })}
                onBlur={() => {
                  const curr = items.find((x) => x.id === it.id);
                  if (curr) saveEdit(curr, { color: curr.color });
                }}
              />
              <input
                className="input flex-1 min-w-0 text-sm font-medium"
                value={it.name}
                onChange={(e) => updateItem(it.id, { name: e.target.value })}
                onBlur={() => {
                  const curr = items.find((x) => x.id === it.id);
                  if (curr) saveEdit(curr, { name: curr.name });
                }}
              />
              <div className="flex items-center gap-1 shrink-0">
                <button className="btn-outline px-2 py-1.5 text-xs" onClick={() => move(it, -1)} disabled={i === 0}>↑</button>
                <button className="btn-outline px-2 py-1.5 text-xs" onClick={() => move(it, 1)} disabled={i === sorted.length - 1}>↓</button>
                <button className="btn-outline px-2 py-1.5 text-xs" onClick={() => remove(it)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
