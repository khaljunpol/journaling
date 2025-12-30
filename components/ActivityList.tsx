"use client";

import { useEffect, useRef, useState } from 'react';

type Activity = { id: string; name: string };

export default function ActivityList() {
  const [items, setItems] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [account, setAccount] = useState<string>('Alex');
  const fetchVersionRef = useRef(0);
  const actsCtrlRef = useRef<AbortController | null>(null);

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
      if (v === fetchVersionRef.current) setItems(Array.isArray(data) ? data : []);
    } catch {
      if (v === fetchVersionRef.current) setItems([]);
    }
  }

  useEffect(() => {
    // Clear items and abort in-flight requests on account change, then refresh
    if (actsCtrlRef.current) actsCtrlRef.current.abort();
    setItems([]);
    refresh();
  }, [account]);

  async function add() {
    if (!name.trim()) return;
    const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { method: 'POST', body: JSON.stringify({ name }), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      let msg = 'Failed to create activity';
      try { const j = await res.json(); msg = j?.error || msg; } catch {}
      console.error(msg);
      return;
    }
    setName('');
    refresh();
  }

  async function update(id: string, newName: string) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'PATCH', body: JSON.stringify({ name: newName }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Activities</h2>
      <div className="flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" placeholder="New activity" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black" onClick={add}>Add</button>
      </div>
      <ul className="space-y-2">
        {items.map((a, i) => (
          <li key={a.id || i} className="flex items-center gap-2">
            <input className="flex-1 rounded border px-2 py-1" defaultValue={a.name} onBlur={(e) => update(a.id, e.target.value)} />
            <button className="rounded border px-2 py-1" onClick={() => remove(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
