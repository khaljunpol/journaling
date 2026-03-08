"use client";

import { useEffect, useRef, useState } from 'react';
import type { TimeCategory as Category } from '@/lib/types';

export default function TimeCategoriesEditor() {
  const [account, setAccount] = useState<string>('Alex');
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#888888');
  const [isSaving, setIsSaving] = useState(false);
  const ctrlRef = useRef<AbortController|null>(null);

  useEffect(() => {
    const cookieAccount = (() => { try { const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; } })();
    const init = cookieAccount || (typeof window !== 'undefined' ? localStorage.getItem('account') : null);
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    const onAccountChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const cookieAcc = (() => { try { const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; } })();
      setAccount(detail || cookieAcc || (typeof window !== 'undefined' ? localStorage.getItem('account') : null) || 'Alex');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('account-change', onAccountChange as EventListener);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('account-change', onAccountChange as EventListener); };
  }, []);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      const controller = new AbortController();
      ctrlRef.current = controller;
      const res = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`, { signal: controller.signal });
      if (!res.ok) { setItems([]); return; }
      const list: Category[] = await res.json();
      setItems(list || []);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // ignore aborted refresh
        return;
      }
      setItems([]);
    }
  }

  useEffect(() => { refresh(); }, [account]);

  function updateItem(id: string, patch: Partial<Category>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function saveNew() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const order = (items?.length || 0) + 1;
      const res = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed, color, order }) });
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
      const res = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, name: patch.name ?? it.name, color: patch.color ?? it.color, order: patch.order ?? it.order }) });
      if (res.ok) refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(it: Category) {
    if (!confirm(`Delete category "${it.name}"?`)) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/time/categories?account=${encodeURIComponent(account)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id }) });
      if (res.ok) refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function move(it: Category, dir: -1 | 1) {
    const sorted = [...items].sort((a,b)=>a.order-b.order);
    const idx = sorted.findIndex((x)=>x.id===it.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const other = sorted[targetIdx];
    // swap orders
    saveEdit(it, { order: other.order });
    saveEdit(other, { order: it.order });
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Time Categories</h2>

      <div className="card p-4 space-y-3">
        <div className="subtle text-xs uppercase tracking-wider">Add Category</div>
        <div className="mt-2 overflow-x-auto">
          <div className="flex flex-wrap gap-2 items-center">
            <input className="input text-sm flex-1 min-w-40" placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
            <input className="input text-sm w-16" type="color" value={color} onChange={(e)=>setColor(e.target.value)} />
            <button className="btn text-sm" onClick={saveNew} disabled={isSaving || !name.trim()}>Add</button>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="subtle text-xs uppercase tracking-wider">Categories ({items.length})</div>
        <div className="overflow-x-auto">
          <ul className="space-y-2">
            {items.sort((a,b)=>a.order-b.order).map((it) => (
              <li key={it.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 min-w-180">
                <span className="inline-block h-4 w-4 rounded" style={{ background: it.color }} />
                <input className="input px-2 py-1 text-sm w-full" value={it.name} onChange={(e)=> updateItem(it.id, { name: e.target.value })} onBlur={()=> {
                  const curr = items.find((x)=>x.id===it.id);
                  if (curr) saveEdit(curr, { name: curr.name });
                }} />
                <input
                  className="input px-2 py-1 text-sm w-24"
                  type="color"
                  value={it.color}
                  onInput={(e)=> updateItem(it.id, { color: (e.target as HTMLInputElement).value })}
                  onBlur={()=> {
                    const curr = items.find((x)=>x.id===it.id);
                    if (curr) saveEdit(curr, { color: curr.color });
                  }}
                />
                <span className="subtle text-xs justify-self-center">#{it.order}</span>
                <div className="flex items-center gap-1 justify-self-end">
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>move(it, -1)} title="Move up">↑</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>move(it, 1)} title="Move down">↓</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>remove(it)} title="Delete">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
