"use client";

import { useEffect, useRef, useState } from 'react';
import type { ActivityStatus, Activity } from '@/lib/types';
import { normalizeStatus, toBackendStatus } from '@/lib/status';

export default function ActivityList() {
  const [items, setItems] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [account, setAccount] = useState<string>('Alex');
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
    if (actsCtrlRef.current) actsCtrlRef.current.abort();
    setItems([]);
    refresh();
  }, [account]);

  async function add() {
    const nm = name.trim();
    if (!nm) return;
    const res = await fetch(`/api/activities?account=${encodeURIComponent(account)}`, { method: 'POST', body: JSON.stringify({ name: nm, status: toBackendStatus('to continue') }), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return;
    setName('');
    showToast(`"${nm}" added`);
    refresh();
  }

  async function updateName(id: string, newName: string) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'PATCH', body: JSON.stringify({ name: newName }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function updateStatus(id: string, status: ActivityStatus) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'PATCH', body: JSON.stringify({ status: toBackendStatus(status) }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/activities/${id}?account=${encodeURIComponent(account)}`, { method: 'DELETE' });
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

  const toContinue = items.filter((a) => (a.status || 'to continue') === 'to continue');
  const toStop = items.filter((a) => (a.status || 'to continue') === 'to stop');

  return (
    <section className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none"
          style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          {toast}
        </div>
      )}

      <h2 className="text-xl font-semibold">Activities</h2>

      {/* Add */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm">Add Activity</span>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 input"
            placeholder="Activity name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!name.trim()}>Add</button>
        </div>
      </div>

      {/* To Continue */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: '#22c55e' }} />
          <span className="font-medium text-sm">To Continue</span>
          <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ background: 'var(--surface-alt)' }}>{toContinue.length}</span>
        </div>
        {toContinue.length === 0 && <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No activities yet.</div>}
        <div className="space-y-2">
          {toContinue.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-alt)' }}>
              <div className="min-w-0 flex-1">
                {editingId === a.id ? (
                  <input
                    className="input w-full min-w-0 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a.id); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={() => saveEdit(a.id)}
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium truncate block cursor-pointer" onClick={() => startEdit(a)}>{a.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                  style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border)' }}
                  onClick={() => updateStatus(a.id, 'to stop')}
                >
                  Stop
                </button>
                <button className="btn-outline text-xs px-2.5 py-1.5" onClick={() => remove(a.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* To Stop */}
      {toStop.length > 0 && (
        <div className="card p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full" style={{ background: '#ef4444' }} />
            <span className="font-medium text-sm">To Stop</span>
            <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ background: 'var(--surface-alt)' }}>{toStop.length}</span>
          </div>
          <div className="space-y-2">
            {toStop.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-alt)', opacity: 0.75 }}>
                <span className="text-sm font-medium truncate min-w-0 line-through" style={{ color: 'var(--muted-foreground)' }}>{a.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                    style={{ background: 'transparent', color: '#22c55e', border: '1px solid var(--border)' }}
                    onClick={() => updateStatus(a.id, 'to continue')}
                  >
                    Resume
                  </button>
                  <button className="btn-outline text-xs px-2.5 py-1.5" onClick={() => remove(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
