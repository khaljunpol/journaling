"use client";

import { useEffect, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import { parseCookies } from '@/lib/apiHelpers';

export default function DailyWeight({ dateISO }: { dateISO: string }) {
  const [weight, setWeight] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');

  useEffect(() => {
    const cookieAccount = (() => {
      try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; }
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
        const cacheKey = `weight:${account}:${dateISO}`;
        const cached = getCache<{ weight: number | null }>(cacheKey);
        if (cached) {
          const w = cached.data?.weight;
          if (!cancelled) setWeight(w != null && isFinite(w) ? String(w) : '');
        }
        const res = await fetch(`/api/weights?date=${dateISO}&account=${encodeURIComponent(account)}`);
        if (res.ok && !cancelled) {
          const j = await res.json();
          const w = j?.weight;
          setWeight(w != null && isFinite(w) ? String(w) : '');
          try { setCache(cacheKey, { weight: w != null && isFinite(w) ? Number(w) : null }); } catch {}
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
    try { setCache(`weight:${account}:${dateISO}`, { weight: w }); } catch {}
    setSaving(true);
    setSaved(false);
    await fetch(`/api/weights?account=${encodeURIComponent(account)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateISO, weight: w }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save();
  }

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Weight</span>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>kg</span>
      </div>

      <div className="flex items-center gap-2">
        {saved && <span className="text-xs" style={{ color: '#22c55e' }}>✓</span>}
        <div
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            className="w-14 bg-transparent text-sm outline-none text-right"
            style={{ color: 'var(--text)' }}
            placeholder={loading ? '…' : '0.0'}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>kg</span>
        </div>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
          onClick={save}
          disabled={saving || loading || !weight}
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
