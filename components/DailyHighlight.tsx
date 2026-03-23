"use client";

import { useEffect, useRef, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';

export default function DailyHighlight({ dateISO }: { dateISO: string }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>('Alex');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
        }
        const res = await fetch(`/api/highlights?date=${dateISO}&account=${encodeURIComponent(account)}`);
        if (res.ok && !cancelled) {
          const j = await res.json();
          const nextText = String(j?.text || '');
          setText(nextText);
          try { setCache(cacheKey, { text: nextText }); } catch {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateISO, account]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(120, el.scrollHeight) + 'px';
  }, [text]);

  function doSave(value: string) {
    try { setCache(`highlight:${account}:${dateISO}`, { text: value }); } catch {}
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

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Today's highlight</h2>
        <span
          className="text-xs transition-opacity"
          style={{
            color: saved ? '#22c55e' : 'var(--muted-foreground)',
            opacity: saving || saved ? 1 : 0,
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : ''}
        </span>
      </div>

      <div
        className="relative rounded-2xl px-4 py-4 transition-shadow"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Decorative left stripe */}
        <div
          className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
          style={{ background: 'var(--accent)', opacity: 0.35 }}
        />

        <textarea
          ref={textareaRef}
          className="w-full resize-none bg-transparent outline-none text-base leading-relaxed placeholder-shown:italic"
          style={{
            color: 'var(--text)',
            minHeight: 120,
            paddingLeft: 12,
            fontFamily: 'inherit',
          }}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={loading ? 'Loading…' : 'What made today worth remembering?'}
          disabled={loading}
          rows={4}
        />
      </div>

      {text.length > 0 && (
        <div className="mt-1.5 text-right text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {text.length} chars
        </div>
      )}
    </div>
  );
}
