"use client";

import { useEffect, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';

export default function DailyHighlight({ dateISO }: { dateISO: string }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const init = typeof window !== 'undefined' ? localStorage.getItem('account') : null;
    setAccount(init || 'Alex');
    const onStorage = () => setAccount(localStorage.getItem('account') || 'Alex');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Apply cached immediately
        const cacheKey = `highlight:${account}:${dateISO}`;
        const cached = getCache<{ text: string }>(cacheKey);
        if (cached && typeof cached.data?.text === 'string' && !cancelled) {
          setText(cached.data.text);
          try { setLastUpdated(new Date(cached.cachedAt).toLocaleTimeString()); } catch {}
        }
        const res = await fetch(`/api/highlights?date=${dateISO}&account=${encodeURIComponent(account)}`);
        if (res.ok) {
          const j = await res.json();
          const nextText = String(j?.text || '');
          if (!cancelled) setText(nextText);
          try { setCache(cacheKey, { text: nextText }); } catch {}
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateISO, account]);

  async function save() {
    setSaving(true);
    await fetch(`/api/highlights?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateISO, text }) });
    try { setCache(`highlight:${account}:${dateISO}`, { text }); } catch {}
    setSaving(false);
  }

  const pretty = new Date(dateISO).toLocaleDateString(undefined );

  return (
    <section className="card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-medium">Highlight for {pretty}</h2>
        <p className="card-title">Write a short note that captures the best moment of this day.</p>
        {lastUpdated ? (<div className="subtle text-xs">Updated at {lastUpdated}</div>) : null}
      </div>
      <textarea
        className="w-full input"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Highlight for ${pretty}`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="btn disabled:opacity-60" onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {loading && <span className="subtle">Loading…</span>}
      </div>
    </section>
  );
}
