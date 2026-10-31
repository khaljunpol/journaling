"use client";

import { useEffect, useState } from 'react';
import SlotPainter from '@/components/quick/SlotPainter';
import { applyTemplate } from '@journaling/core/quickDay';
import type { TimeCategory } from '@/lib/types';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';

type Slots = Array<number | null>;
type Kind = 'weekday' | 'weekend';

const EMPTY: Slots = Array.from({ length: 24 }, () => null);

function sameSlots(a: Slots, b: Slots) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function normalise(v: unknown): Slots {
  if (!Array.isArray(v) || v.length !== 24) return EMPTY.slice();
  return v.map((x) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null));
}

export default function HourTemplatesEditor() {
  const [cats, setCats] = useState<TimeCategory[]>([]);
  const [saved, setSaved] = useState<Record<Kind, Slots>>({ weekday: EMPTY.slice(), weekend: EMPTY.slice() });
  const [draft, setDraft] = useState<Record<Kind, Slots>>({ weekday: EMPTY.slice(), weekend: EMPTY.slice() });
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [message, setMessage] = useState<{ kind: Kind; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([fetch('/api/settings'), fetch('/api/time/categories')]);
        if (!sRes.ok || !cRes.ok) throw new Error('load failed');
        const s = await sRes.json();
        const c = await cRes.json();
        if (!alive) return;
        if (!Array.isArray(c)) throw new Error('load failed');
        const ids = (c as TimeCategory[]).map((x) => Number(x.id));
        const raw = { weekday: normalise(s?.hourTemplateWeekday), weekend: normalise(s?.hourTemplateWeekend) };
        setSaved(raw);
        setDraft({
          weekday: applyTemplate(raw.weekday, ids),
          weekend: applyTemplate(raw.weekend, ids),
        });
        setCats(c);
      } catch {
        if (alive) setLoadFailed(true);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function save(kind: Kind) {
    setSaving(kind);
    setMessage(null);
    try {
      const body = kind === 'weekday' ? { hourTemplateWeekday: draft.weekday } : { hourTemplateWeekend: draft.weekend };
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
    const slots = draft[kind];
    const filled = slots.filter((v) => v !== null).length;
    const complete = filled === 24;
    const dirty = !sameSlots(slots, saved[kind]);
    const status = dirty ? 'Unsaved changes' : complete ? 'Saved' : '';
    return (
      <Card className="space-y-3" key={kind}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-[14px] font-medium">{title}</span>
          <Chip>{filled}/24</Chip>
          {status && (
            <span className="text-xs ml-auto" style={{ color: dirty ? 'var(--accent)' : 'var(--text-2)' }}>{status}</span>
          )}
        </div>
        {cats.length === 0 && loaded ? (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Add a category above to start.</p>
        ) : (
          <SlotPainter
            value={slots}
            categories={cats}
            onChange={(next) => {
              setDraft((p) => ({ ...p, [kind]: next }));
              // An old "couldn't save" no longer describes what is on screen.
              setMessage((m) => (m?.kind === kind ? null : m));
            }}
          />
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs" role="status" style={{ color: 'var(--text-2)' }}>
            {message?.kind === kind ? message.text : !complete ? `${24 - filled} hours left to fill` : ''}
          </span>
          <Button className="shrink-0" onClick={() => save(kind)} disabled={loadFailed || !complete || !dirty || saving !== null}>
            {saving === kind ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[20px] font-semibold" style={{ color: 'var(--text-1)' }}>Normal days</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
          Pick a category, then tap or drag across the hours. Quick check-in starts from these.
        </p>
      </div>
      {loadFailed ? (
        // One message for the whole section: either read (settings or categories) can be the one that failed.
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Couldn&apos;t load your usual hours just now. Reload to try again.</p>
        </Card>
      ) : (
        <>
          {renderCard('weekday', 'Normal weekday')}
          {renderCard('weekend', 'Normal weekend')}
        </>
      )}
    </section>
  );
}
