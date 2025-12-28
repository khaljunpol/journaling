"use client";

import { useEffect, useState } from 'react';

export default function DailyHighlight({ dateISO }: { dateISO: string }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');

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
        const res = await fetch(`/api/highlights?date=${dateISO}&account=${encodeURIComponent(account)}`);
        if (res.ok) {
          const j = await res.json();
          if (!cancelled) setText(String(j?.text || ''));
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
    setSaving(false);
  }

  const pretty = new Date(dateISO).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <section className="rounded border p-4">
      <div className="mb-3">
        <h2 className="text-lg font-medium">Highlight for {pretty}</h2>
        <p className="text-sm text-neutral-500">Write a short note that captures the best moment of this day.</p>
      </div>
      <textarea
        className="w-full rounded border p-2"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Highlight for ${pretty}`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="rounded bg-black px-3 py-1 text-white disabled:opacity-60 dark:bg-white dark:text-black" onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {loading && <span className="text-sm text-neutral-500">Loading…</span>}
      </div>
    </section>
  );
}
