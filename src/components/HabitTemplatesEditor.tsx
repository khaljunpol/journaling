"use client";

import { useEffect, useState } from 'react';
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
        const active = (a as Activity[]).filter((x) => x.status !== 'stopped');
        const ids = new Set(active.map((x) => x.id));
        // Ids of stopped or deleted habits are dropped from the view.
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
      <div className="card p-4 sm:p-5 space-y-3" key={kind}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs rounded-full px-2 py-0.5 tabular-nums" style={{ background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }}>{ids.length}/{acts.length}</span>
          {status && (
            <span className="text-xs ml-auto" style={{ color: dirty ? 'var(--accent)' : 'var(--muted-foreground)' }}>{status}</span>
          )}
        </div>
        {loadFailed ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Couldn&apos;t load your habits just now. Reload to try again.</p>
        ) : acts.length === 0 && loaded ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Add a habit first, then pick your usual ones here.</p>
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
                    className="quick-tile flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-sm"
                    style={{
                      background: on ? 'var(--ok-soft)' : 'var(--surface-alt)',
                      boxShadow: on ? '0 0 0 1.5px var(--ok)' : undefined,
                    }}
                  >
                    <span>{a.name}</span>
                    <span aria-hidden="true" style={{ color: on ? 'var(--ok)' : 'var(--muted-foreground)' }}>{on ? '✓' : '○'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs" role="status" style={{ color: 'var(--muted-foreground)' }}>
            {message?.kind === kind ? message.text : ''}
          </span>
          <button className="btn h-11 shrink-0" onClick={() => save(kind)} disabled={loadFailed || !dirty || saving !== null}>
            {saving === kind ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Usual habits</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Tick the habits you normally do. Quick check-in starts from these on an empty day.
        </p>
      </div>
      {renderCard('weekday', 'Usual weekday habits')}
      {renderCard('weekend', 'Usual weekend habits')}
    </section>
  );
}
