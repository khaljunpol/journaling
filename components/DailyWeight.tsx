"use client";

import { useEffect, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';

export default function DailyWeight({ dateISO }: { dateISO: string }) {
  const [weight, setWeight] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Apply cached immediately
        const cacheKey = `weight:${account}:${dateISO}`;
        const cached = getCache<{ weight: number | null }>(cacheKey);
        if (cached) {
          const w = cached.data?.weight;
          if (!cancelled) setWeight(w != null && isFinite(w) ? String(w) : '');
          try { setLastUpdated(new Date(cached.cachedAt).toLocaleTimeString()); } catch {}
        }
        const res = await fetch(`/api/weights?date=${dateISO}&account=${encodeURIComponent(account)}`);
        if (res.ok) {
          const j = await res.json();
          const w = j?.weight;
          if (!cancelled) setWeight(w != null && isFinite(w) ? String(w) : '');
          try { setCache(cacheKey, { weight: w != null && isFinite(w) ? Number(w) : null }); } catch {}
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
    const w = parseFloat(weight);
    if (!isFinite(w)) return;
    setSaving(true);
    await fetch(`/api/weights?account=${encodeURIComponent(account)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateISO, weight: w }) });
    try { setCache(`weight:${account}:${dateISO}`, { weight: w }); } catch {}
    setSaving(false);
  }

  const pretty = new Date(dateISO).toLocaleDateString(undefined);

  return (
    <section className="card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-medium">Weight for {pretty}</h2>
        <p className="card-title">Log today's weight.</p>
        {lastUpdated ? (<div className="subtle text-xs">Updated at {lastUpdated}</div>) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          className="w-32 input"
          placeholder="e.g. 70.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <span className="subtle">kg</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button className="btn disabled:opacity-60" onClick={save} disabled={saving || loading || !weight}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {loading && <span className="subtle">Loading…</span>}
      </div>
    </section>
  );
}
