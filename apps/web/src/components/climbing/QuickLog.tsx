'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_BOULDER_GRADE, DEFAULT_ROPE_GRADE } from '@journaling/core/climbing';
import { dayLabel, fallsLabel, gradesFor, type ClimbType } from './types';

const KEY = 'climb:quicklog:v1';
type Saved = { session: number; location: string; type: ClimbType; grades: Record<ClimbType, string> };
const DEFAULTS: Saved = { session: 1, location: '', type: 'boulder', grades: { boulder: DEFAULT_BOULDER_GRADE, rope: DEFAULT_ROPE_GRADE } };

function load(): Saved {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (!p || typeof p !== 'object') return DEFAULTS;
    const type: ClimbType = p.type === 'rope' ? 'rope' : 'boulder';
    const pick = (t: ClimbType, d: string) => (typeof p.grades?.[t] === 'string' && gradesFor(t).includes(p.grades[t]) ? p.grades[t] : d);
    const session = Number.isInteger(p.session) && p.session >= 1 && p.session <= 99 ? p.session : 1;
    return { session, location: typeof p.location === 'string' ? p.location.slice(0, 80) : '', type, grades: { boulder: pick('boulder', DEFAULT_BOULDER_GRADE), rope: pick('rope', DEFAULT_ROPE_GRADE) } };
  } catch { return DEFAULTS; }
}
function store(s: Saved) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: ignore */ }
}

const link = 'inline-flex min-h-11 items-center text-[13px] font-medium underline-offset-2 hover:underline';

type Props = {
  today: string;
  date: string;
  onDateChange: (d: string) => void;
  /** Called after a save or an undo so the lists reload. */
  onChanged: () => void;
};

/** Top of the Log tab. Pick a grade once, then one tap on the outcome saves the climb. */
export default function QuickLog({ today, date, onDateChange, onChanged }: Props) {
  const { show } = useToast();
  const [initial] = useState<Saved>(() => (typeof window === 'undefined' ? DEFAULTS : load()));
  const [session, setSession] = useState(initial.session);
  const [location, setLocation] = useState(initial.location);
  const [type, setType] = useState<ClimbType>(initial.type);
  const [grades, setGrades] = useState(initial.grades);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [editDate, setEditDate] = useState(false);
  const [editGym, setEditGym] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('4');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const grade = grades[type];
  const list = gradesFor(type);

  useEffect(() => { store({ session, location, type, grades }); }, [session, location, type, grades]);

  // Keep the selected chip in view (centred in the scroll row).
  useEffect(() => {
    const box = scrollRef.current;
    const chip = chipRefs.current[`${type}:${grade}`];
    if (!box || !chip) return;
    box.scrollLeft = chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2;
  }, [type, grade]);

  const customN = parseInt(custom, 10);
  const customOk = Number.isInteger(customN) && customN >= 4 && customN <= 99;

  async function save(attempts: number) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const res = await fetch('/api/climbing/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, session, type, grade, attempts, location: location.trim(), notes: '' }),
      });
      if (!res.ok) throw new Error('save failed');
      const saved = (await res.json().catch(() => null)) as { id?: string } | null;
      const id = typeof saved?.id === 'string' && saved.id ? saved.id : undefined;
      const msg = attempts === 0 ? `${grade} flash saved` : `${grade} · ${attempts} ${attempts === 1 ? 'fall' : 'falls'} saved`;
      let undone = false;
      show(msg, id ? {
        label: 'Undo',
        run: () => {
          if (undone) return;
          undone = true;
          void fetch(`/api/climbing/logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
            .then((r) => { if (!r.ok) show("Couldn't undo. Try again."); })
            .catch(() => show("Couldn't undo. Try again."))
            .finally(onChanged);
        },
      } : undefined);
      setCustomOpen(false);
      onChanged();
    } catch {
      show("Couldn't save. Try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const seg = (t: ClimbType, text: string) => (
    <button
      key={t}
      type="button"
      aria-pressed={type === t}
      onClick={() => { setType(t); setCustomOpen(false); }}
      className="min-h-11 flex-1 rounded-[8px] px-4 text-[14px] font-medium"
      style={type === t ? { background: 'var(--accent-fill)', color: 'var(--on-accent-fill)' } : { color: 'var(--text-2)' }}
    >
      {text}
    </button>
  );

  return (
    <Card>
      <div className="space-y-3">
        {/* Date + session */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {editDate ? (
              <Input
                aria-label="Date"
                type="date"
                value={date}
                onChange={(e) => { if (e.target.value) { onDateChange(e.target.value); setEditDate(false); } }}
                autoFocus
                className="w-auto"
              />
            ) : (
              <>
                <span className="truncate text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{date === today ? 'Today' : dayLabel(date)}</span>
                <button type="button" className={link} style={{ color: 'var(--accent)' }} onClick={() => setEditDate(true)}>change</button>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center" role="group" aria-label="Session">
            <button type="button" aria-label="Previous session" disabled={session <= 1} onClick={() => setSession((s) => Math.max(1, s - 1))} className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--surface-2)] disabled:opacity-40" style={{ color: 'var(--text-2)' }}>
              <Minus size={18} aria-hidden="true" />
            </button>
            <span className="num min-w-9 text-center text-[15px] font-semibold" style={{ color: 'var(--text-1)' }} aria-live="polite">S{session}</span>
            <button type="button" aria-label="Next session" disabled={session >= 99} onClick={() => setSession((s) => Math.min(99, s + 1))} className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--surface-2)] disabled:opacity-40" style={{ color: 'var(--text-2)' }}>
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Type + gym */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex w-44 shrink-0 rounded-[10px] p-0.5" role="group" aria-label="Type" style={{ background: 'var(--surface-2)' }}>
            {seg('boulder', 'Boulder')}
            {seg('rope', 'Rope')}
          </div>
          {editGym ? (
            <Input
              aria-label="Gym"
              placeholder="Gym name"
              maxLength={80}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => setEditGym(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setEditGym(false); } }}
              autoFocus
              className="min-w-0 flex-1"
            />
          ) : (
            <button type="button" className={`${link} min-w-0 justify-end`} style={{ color: location ? 'var(--text-1)' : 'var(--accent)' }} onClick={() => setEditGym(true)}>
              <span className="truncate">{location || 'Add gym'}</span>
            </button>
          )}
        </div>

        {/* Grade chips: swipe sideways */}
        <div ref={scrollRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5" role="group" aria-label="Grade" style={{ scrollbarWidth: 'none' }}>
          {list.map((g) => (
            <button
              key={g}
              ref={(el) => { chipRefs.current[`${type}:${g}`] = el; }}
              type="button"
              aria-pressed={g === grade}
              onClick={() => setGrades((prev) => ({ ...prev, [type]: g }))}
              className="num min-h-11 min-w-12 shrink-0 rounded-full border px-3 text-[15px] font-semibold"
              style={g === grade
                ? { background: 'var(--accent-fill)', borderColor: 'var(--accent-fill)', color: 'var(--on-accent-fill)' }
                : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Outcome: one tap saves */}
        <div>
          <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>
            Save {grade} as
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3].map((n) => (
              <Button key={n} variant={n === 0 ? 'primary' : 'outline'} disabled={saving} aria-label={n === 0 ? `Flash ${grade}` : `${grade}, ${fallsLabel(n)}`} className="min-h-12 !px-0" onClick={() => void save(n)}>
                {n === 0 ? 'Flash' : n}
              </Button>
            ))}
            <Button variant="outline" disabled={saving} aria-expanded={customOpen} aria-label={`${grade}, 4 or more falls`} className="min-h-12 !px-0" onClick={() => setCustomOpen((o) => !o)}>4+</Button>
          </div>
          {customOpen && (
            <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (customOk) void save(customN); }}>
              <Input aria-label="Falls (4 to 99)" type="number" inputMode="numeric" min={4} max={99} value={custom} onChange={(e) => setCustom(e.target.value)} autoFocus className="min-w-0 flex-1" />
              <Button type="submit" disabled={saving || !customOk}>Save</Button>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
