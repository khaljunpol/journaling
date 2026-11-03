'use client';

import { useEffect, useState } from 'react';
import { CATEGORIES, categoryOf, type HabitCategory } from '@journaling/core/habitCategory';
import type { Activity } from '@journaling/core/types';
import Button from '@/components/ui/Button';
import Sheet from '@/components/ui/Sheet';
import CategorySelect from './CategorySelect';

const startDraft = (habits: Activity[]) => Object.fromEntries(habits.map((h) => [h.id, categoryOf(h)]));

/** One-time setup: every habit already sits in a suggested group, so most people just confirm. */
export default function SortHabitsSheet({ open, onClose, habits, onSaved }: { open: boolean; onClose: () => void; habits: Activity[]; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, HabitCategory>>(() => startDraft(habits));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(startDraft(habits));
    setFailed(false);
  }, [open, habits]);

  async function save() {
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch('/api/activities/categories', {
        method: 'PUT',
        body: JSON.stringify({ categories: draft }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('save failed');
      onSaved();
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Sort your habits" initialFocus="panel">
      <div className="space-y-5 pt-2">
        {CATEGORIES.map((c) => {
          const rows = habits.filter((h) => (draft[h.id] ?? categoryOf(h)) === c.id);
          if (rows.length === 0) return null;
          return (
            <section key={c.id}>
              <h3 className="mb-1 text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>{c.label}</h3>
              <ul>
                {rows.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-1">
                    <span className="min-w-0 truncate text-[15px]" style={{ color: 'var(--text-1)' }}>{h.name}</span>
                    <CategorySelect value={c.id} label={h.name} onChange={(v) => setDraft((d) => ({ ...d, [h.id]: v }))} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {failed ? <p role="alert" className="text-[14px]" style={{ color: 'var(--text-2)' }}>Couldn&apos;t save. Try again.</p> : null}
        <Button className="w-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Looks right'}</Button>
      </div>
    </Sheet>
  );
}
