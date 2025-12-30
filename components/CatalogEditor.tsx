"use client";

import { useEffect, useRef, useState } from 'react';

type CatalogItem = { id: string; name: string; category: string; tags?: string };

export default function CatalogEditor() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState<{ name: string; category: string; tags: string }>({ name: '', category: '', tags: '' });
  const fetchVersionRef = useRef(0);
  const ctrlRef = useRef<AbortController | null>(null);

  async function refresh() {
    const v = ++fetchVersionRef.current;
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      ctrlRef.current = new AbortController();
      const res = await fetch('/api/catalog', { signal: ctrlRef.current.signal });
      if (!res.ok) { if (v === fetchVersionRef.current) setItems([]); return; }
      const data = await res.json();
      if (v === fetchVersionRef.current) setItems(Array.isArray(data) ? data : []);
    } catch {
      if (v === fetchVersionRef.current) setItems([]);
    }
  }

  useEffect(() => { refresh(); return () => { if (ctrlRef.current) ctrlRef.current.abort(); }; }, []);

  async function add() {
    if (!form.name.trim() || !form.category.trim()) return;
    const res = await fetch('/api/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      setForm({ name: '', category: '', tags: '' });
      refresh();
    }
  }

  async function update(id: string, patch: Partial<CatalogItem>) {
    await fetch(`/api/catalog/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/catalog/${encodeURIComponent(id)}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-medium">Activity Catalog Editor</h3>
      <div className="flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border px-2 py-1" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="rounded border px-2 py-1" placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <button className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black" onClick={add}>Add to Catalog</button>
      </div>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <input className="min-w-48 flex-1 rounded border px-2 py-1" defaultValue={c.name} onBlur={(e) => update(c.id, { name: e.target.value })} />
            <input className="min-w-40 rounded border px-2 py-1" defaultValue={c.category} onBlur={(e) => update(c.id, { category: e.target.value })} />
            <input className="min-w-48 rounded border px-2 py-1" defaultValue={c.tags || ''} onBlur={(e) => update(c.id, { tags: e.target.value })} />
            <button className="rounded border px-2 py-1" onClick={() => remove(c.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
