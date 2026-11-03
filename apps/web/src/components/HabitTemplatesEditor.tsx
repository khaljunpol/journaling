"use client";

import { splitHabits } from '@journaling/core/habitCategory';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
type Activity = { id: string; name: string; status?: string };

type Kind = 'weekday' | 'weekend';
type Ids = string[];

function sameIds(a: Ids, b: Ids) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export default function HabitTemplatesEditor() {
  const [acts, setActs] = useState<Activity[]>([]);
  const [saved, setSaved] = useState<Record<Kind, Ids>>({ weekday: [], weekend: [] });
  const [draft, setDraft] = useState<Record<Kind, Ids>>({ weekday: [], weekend: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [message, setMessage] = useState<{ kind: Kind; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sRes, aRes] = await Promise.all([fetch('/api/settings'), fetch('/api/activities')]);
        if (!sRes.ok || !aRes.ok) throw new Error('load failed');
        const s = await sRes.json();
        const a = await aRes.json();
        if (!alive) return;
        if (!Array.isArray(a)) throw new Error('load failed');
        // A usual day never includes a bad habit.
        const active = splitHabits(a as Activity[]).good;
        const ids = new Set(active.map((x) => x.id));
        // Ids of deleted habits are dropped from the view.
        const clean = (v: unknown): Ids => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ids.has(x)) : []);
        const next = { weekday: clean(s?.habitTemplateWeekday), weekend: clean(s?.habitTemplateWeekend) };
        setActs(active);
        setSaved(next);
        setDraft({ weekday: next.weekday.slice(), weekend: next.weekend.slice() });
      } catch {
        if (alive) setLoadFailed(true);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  function toggle(kind: Kind, id: string) {
    setDraft((p) => ({
      ...p,
      [kind]: p[kind].includes(id) ? p[kind].filter((x) => x !== id) : [...p[kind], id],
    }));
  }

  async function save(kind: Kind) {
    setSaving(kind);
    setMessage(null);
    try {
      const body = kind === 'weekday' ? { habitTemplateWeekday: draft.weekday } : { habitTemplateWeekend: draft.weekend };
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('save failed');
      setSaved((p) => ({ ...p, [kind]: draft[kind].slice() }));
    } catch {
      setMessage({ kind, text: "Couldn't save just now. Your changes are still here, try again." });
    } finally {
      setSaving(null);
    }
  }

  function renderCard(kind: Kind, title: string) {
    const ids = draft[kind];
    const dirty = !sameIds(ids, saved[kind]);
    const status = dirty ? 'Unsaved changes' : loaded && !loadFailed ? 'Saved' : '';
    return (
      <Card className="space-y-3" key={kind}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-[14px] font-medium">{title}</span>
          <Chip>{ids.length}/{acts.length}</Chip>
          {status && (
            <span className="text-xs ml-auto" style={{ color: dirty ? 'var(--accent)' : 'var(--text-2)' }}>{status}</span>
          )}
        </div>
        {loadFailed ? (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Couldn&apos;t load your habits just now. Reload to try again.</p>
        ) : acts.length === 0 && loaded ? (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Add a habit first, then pick your usual ones here.</p>
        ) : (
          <ul className="space-y-2">
            {acts.map((a) => {
              const on = ids.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(kind, a.id)}
                    className="quick-tile flex min-h-12 w-full items-center justify-between rounded-[10px] px-4 text-left text-[14px]"
                    style={{
                      background: on ? 'var(--ok-soft)' : 'var(--surface-2)',
                      boxShadow: on ? '0 0 0 1.5px var(--ok)' : undefined,
                    }}
                  >
                    <span>{a.name}</span>
                    <span aria-hidden="true" style={{ color: on ? 'var(--ok)' : 'var(--text-2)' }}>{on ? '✓' : '○'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs" role="status" style={{ color: 'var(--text-2)' }}>
            {message?.kind === kind ? message.text : ''}
          </span>
          <Button className="shrink-0" onClick={() => save(kind)} disabled={loadFailed || !dirty || saving !== null}>
            {saving === kind ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[20px] font-semibold" style={{ color: 'var(--text-1)' }}>Usual habits</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
          Tick the habits you normally do. Quick check-in starts from these on an empty day.
        </p>
      </div>
      {renderCard('weekday', 'Usual weekday habits')}
      {renderCard('weekend', 'Usual weekend habits')}
    </section>
  );
}
