"use client";

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { fieldBase } from '@/components/ui/Input';
import { getCache, setCache } from '@/lib/cache';

export default function DailyWeight({ dateISO }: { dateISO: string }) {
  const [weight, setWeight] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const cacheKey = `weight:${dateISO}`;
        const cached = getCache<{ weight: number | null }>(cacheKey);
        if (cached) {
          const w = cached.data?.weight;
          if (!cancelled) setWeight(w != null && isFinite(w) ? String(w) : '');
        }
        const res = await fetch(`/api/weights?date=${dateISO}`);
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
  }, [dateISO]);

  async function save() {
    const w = parseFloat(weight);
    if (!isFinite(w)) return;
    try { setCache(`weight:${dateISO}`, { weight: w }); } catch {}
    setSaving(true);
    setSaved(false);
    await fetch('/api/weights', {
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
    <div className="flex w-full items-center justify-between gap-3">
      <label htmlFor="trend-weight" className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>
        Weight today
      </label>
      <div className="flex items-center gap-2">
        {saved && <span className="text-[13px]" style={{ color: 'var(--ok)' }} role="status">Saved</span>}
        <div className="relative">
          <input
            id="trend-weight"
            type="number"
            step="0.1"
            inputMode="decimal"
            className={`${fieldBase} num min-h-11 w-28 pl-3 pr-9 text-right`}
            placeholder={loading ? '…' : '0.0'}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: 'var(--text-3)' }}>kg</span>
        </div>
        <Button onClick={save} disabled={saving || loading || !weight}>
          {saving ? '…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
