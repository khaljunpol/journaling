"use client";

import { useEffect, useRef, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';

export default function DailyHighlight({ dateISO }: { dateISO: string }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          if (!cancelled) setLastUpdated(new Date().toLocaleTimeString());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateISO, account]);

  function doSave(value: string) {
    try { setCache(`highlight:${account}:${dateISO}`, { text: value }); } catch {}
    setLastUpdated(new Date().toLocaleTimeString());
    setSaving(true);
    setSaved(false);
    fetch(`/api/highlights?account=${encodeURIComponent(account)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateISO, text: value }),
    }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .finally(() => setSaving(false));
  }

  function handleChange(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(value), 1500);
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSave(text);
  }

  const pretty = new Date(dateISO).toLocaleDateString(undefined);

  return (
    <section className="card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-medium">Highlight for {pretty}</h2>
        <p className="card-title">Write a short note that captures the best moment of this day.</p>
        <div className="flex items-center gap-2 mt-0.5">
          {lastUpdated && <span className="subtle">Updated {lastUpdated}</span>}
          {saving && <span className="subtle">Saving…</span>}
          {saved && !saving && <span className="text-xs text-emerald-500 font-medium">Saved ✓</span>}
        </div>
      </div>
      <textarea
        className="w-full input"
        rows={4}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={`Highlight for ${pretty}`}
        disabled={loading}
      />
      {loading && <div className="mt-1 subtle">Loading…</div>}
    </section>
  );
}
