"use client";

import { useEffect, useRef, useState } from 'react';
import type { ActivityStatus, Activity, CatalogItem } from '@/lib/types';
import { normalizeStatus, toBackendStatus } from '@/lib/status';

// Types now imported from shared lib

export default function ActivityList() {
  const [items, setItems] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [account, setAccount] = useState<string>('Alex');
  const fetchVersionRef = useRef(0);
  const actsCtrlRef = useRef<AbortController | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

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

  async function refresh() {
    const v = ++fetchVersionRef.current;
    try {
      if (actsCtrlRef.current) actsCtrlRef.current.abort();
      actsCtrlRef.current = new AbortController();
      const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { signal: actsCtrlRef.current.signal });
      if (!res.ok) { if (v === fetchVersionRef.current) setItems([]); return; }
      const data = await res.json();
      const arr: Activity[] = Array.isArray(data) ? (data as Activity[]).map((a) => ({ ...a, status: normalizeStatus(a.status as any) })) : [];
      if (v === fetchVersionRef.current) setItems(arr);
    } catch {
      if (v === fetchVersionRef.current) setItems([]);
    }
  }

  useEffect(() => {
    // Clear items and abort in-flight requests on account change, then refresh
    if (actsCtrlRef.current) actsCtrlRef.current.abort();
    setItems([]);
    refresh();
    // Also refresh catalog (shared)
    (async () => {
      try {
        const res = await fetch('/api/catalog');
        const data = await res.json();
        setCatalog(Array.isArray(data) ? data : []);
      } catch { setCatalog([]); }
    })();
  }, [account]);

  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');

  async function add() {
    const nm = name.trim();
    if (!nm) return;
    // Try auto-link to catalog by name match
    const match = catalog.find((c) => c.name.trim().toLowerCase() === nm.toLowerCase());
    const payload: any = { name: nm, status: toBackendStatus('to continue') };
    if (match) payload.catalogId = match.id;
    const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      let msg = 'Failed to create activity';
      try { const j = await res.json(); msg = j?.error || msg; } catch { }
      console.error(msg);
      return;
    }
    setName('');
    setCategory('');
    setTags('');
    refresh();
  }

  async function quickAdd(n: string) {
    if (!n.trim()) return;
    setAddingId(n);
    try {
      const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { method: 'POST', body: JSON.stringify({ name: n, status: toBackendStatus('to continue') }), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) return;
      refresh();
    } finally {
      setAddingId(null);
    }
  }

  async function updateName(id: string, newName: string) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'PATCH', body: JSON.stringify({ name: newName }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function updateStatus(id: string, status: ActivityStatus) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'PATCH', body: JSON.stringify({ status: toBackendStatus(status) }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function addFromCatalog(c: CatalogItem) {
    setAddingId(c.id);
    try {
      const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, catalogId: c.id, status: 'to continue' }),
      });
      if (res.ok) refresh();
    } finally {
      setAddingId(null);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Activities</h2>
        <a href="/catalog" className="text-sm underline underline-offset-2 hover:no-underline">Manage Catalog</a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="card-title">Add New Activity</div>
          <div className="mt-2 flex gap-2">
            <input className="flex-1 input" placeholder="Activity name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" onClick={add}>Add</button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <input
                className="w-full input"
                placeholder="Category (suggested)"
                list="categoriesList"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="categoriesList">
                {Array.from(new Set(catalog.map((c) => c.category))).map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <input
                className="w-full input"
                placeholder="Tags (comma-separated, suggested)"
                list="tagsList"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <datalist id="tagsList">
                {Array.from(new Set(
                  catalog.flatMap((c) => (c.tags || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean))
                )).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <p className="mt-2 subtle">Use Catalog below for quick adds</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="card-title">Add from Catalog</div>
            <a href="/catalog" className="text-xs underline underline-offset-2 hover:no-underline">Edit Catalog</a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {catalog
              .filter((c) => {
                const byCatalogId = items.some((a) => (a.catalogId || '') === c.id);
                const byName = items.some((a) => a.name.trim().toLowerCase() === c.name.trim().toLowerCase());
                return !byCatalogId && !byName;
              })
              .map((c) => (
                <button
                  key={c.id}
                  className={`btn-outline text-sm ${addingId === c.id ? 'opacity-60' : ''}`}
                  onClick={() => addFromCatalog(c)}
                  disabled={addingId === c.id}
                  title={`${c.category}${c.tags ? ` • ${c.tags}` : ''}`}
                >
                  {c.name}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 card-title">Your Activities</div>
        {/* Grouped by status */}
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold">To Continue</div>
            <ul className="space-y-2">
              {items.filter((a) => (a.status || 'to continue') === 'to continue').map((a, i) => (
                <li key={a.id || i} className="flex flex-wrap items-center gap-3 rounded border px-3 py-2">
                  <input
                    className="flex-1 input"
                    defaultValue={a.name}
                    onBlur={(e) => updateName(a.id, e.target.value)}
                  />
                  {a.catalogId && (
                    <span className="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
                      {catalog.find((c) => c.id === a.catalogId)?.category || '—'}
                    </span>
                  )}
                  <select
                    className="input text-sm"
                    value={a.status || 'to continue'}
                    onChange={(e) => updateStatus(a.id, (e.target.value as ActivityStatus))}
                  >
                    <option value="to continue">To Continue</option>
                    <option value="to stop">To Stop</option>
                  </select>
                  <button className="btn-outline text-xs text-red-600 border-red-300 dark:text-red-400 dark:border-red-700" onClick={() => remove(a.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold">To Stop</div>
            <ul className="space-y-2">
              {items.filter((a) => (a.status || 'to continue') === 'to stop').map((a, i) => (
                <li key={a.id || i} className="flex flex-wrap items-center gap-3 rounded border px-3 py-2">
                  <input
                    className="flex-1 input text-red-600 line-through italic dark:text-red-400"
                    defaultValue={a.name}
                    onBlur={(e) => updateName(a.id, e.target.value)}
                  />
                  {a.catalogId && (
                    <span className="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
                      {catalog.find((c) => c.id === a.catalogId)?.category || '—'}
                    </span>
                  )}
                  <select
                    className="input text-sm"
                    value={a.status || 'to continue'}
                    onChange={(e) => updateStatus(a.id, (e.target.value as ActivityStatus))}
                  >
                    <option value="to continue">To Continue</option>
                    <option value="to stop">To Stop</option>
                  </select>
                  <button className="btn-outline text-xs text-red-600 border-red-300 dark:text-red-400 dark:border-red-700" onClick={() => remove(a.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
