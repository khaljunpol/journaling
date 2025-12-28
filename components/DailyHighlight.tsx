"use client";

import { useState } from 'react';

export default function DailyHighlight() {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function save() {
    setSaving(true);
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, text }) });
    setSaving(false);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Highlight of the day</h2>
      <textarea className="w-full rounded border p-2" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a short highlight..." />
      <button className="rounded bg-black px-3 py-1 text-white disabled:opacity-60 dark:bg-white dark:text-black" onClick={save} disabled={saving}>Save highlight</button>
    </section>
  );
}
