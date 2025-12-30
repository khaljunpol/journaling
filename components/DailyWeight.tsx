"use client";

import { useEffect, useState } from 'react';

export default function DailyWeight({ dateISO }: { dateISO: string }) {
  const [weight, setWeight] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');

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
        const res = await fetch(`/api/weights?date=${dateISO}&account=${encodeURIComponent(account)}`);
        if (res.ok) {
          const j = await res.json();
          const w = j?.weight;
          if (!cancelled) setWeight(w != null && isFinite(w) ? String(w) : '');
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
    setSaving(false);
  }

  const pretty = new Date(dateISO).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <section className="rounded border p-4">
      <div className="mb-3">
        <h2 className="text-lg font-medium">Weight for {pretty}</h2>
        <p className="text-sm text-neutral-500">Log today\'s weight.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          className="w-32 rounded border p-2"
          placeholder="e.g. 70.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <span className="text-sm text-neutral-600">kg</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button className="rounded bg-black px-3 py-1 text-white disabled:opacity-60 dark:bg.white dark:text.black" onClick={save} disabled={saving || loading || !weight}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {loading && <span className="text-sm text-neutral-500">Loading…</span>}
      </div>
    </section>
  );
}
