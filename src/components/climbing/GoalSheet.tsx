'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input, { Label } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_BOULDER_GRADE, DEFAULT_ROPE_GRADE, normalizeGrade } from '@/lib/climbing';
import { gradesFor, type ClimbType } from './types';

type ExistingGoal = { id: string; year: number; type: ClimbType; grade: string; target: number };

/** Easiest grade of this type that has no goal yet in this year (falls back to the usual default). */
function freeGrade(type: ClimbType, year: number, goals: ExistingGoal[]): string {
  const taken = new Set(goals.filter((g) => g.year === year && g.type === type).map((g) => normalizeGrade(type, g.grade)));
  const fallback = type === 'boulder' ? DEFAULT_BOULDER_GRADE : DEFAULT_ROPE_GRADE;
  return gradesFor(type).find((g) => !taken.has(normalizeGrade(type, g))) ?? fallback;
}

export type GoalInitial = { id?: string; year: number; type: ClimbType; grade: string; target: number };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Set when editing. Without `id` it only prefills a new goal. */
  initial?: GoalInitial;
  /** All goals, to warn when a save would change an existing one. */
  goals?: ExistingGoal[];
  /** Called after a successful save with the saved goal's year. */
  onSaved: (year: number) => void;
};

const TARGETS = [10, 25, 50, 100];

export default function GoalSheet({ open, onClose, initial, goals = [], onSaved }: Props) {
  const editing = !!initial?.id;
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit goal' : 'New goal'} initialFocus="panel">
      {/* Remount per open so the form always starts from `initial`. */}
      {open && <GoalForm key={initial?.id ?? 'new'} initial={initial} goals={goals} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function GoalForm({ initial, goals = [], onClose, onSaved }: Omit<Props, 'open'>) {
  const { show } = useToast();
  const thisYear = new Date().getFullYear();
  const [type, setType] = useState<ClimbType>(initial?.type ?? 'boulder');
  const [grade, setGrade] = useState(() => {
    if (!initial) return freeGrade('boulder', thisYear, goals);
    // Old rows may hold "v4": match it to the list.
    return gradesFor(initial.type).find((g) => normalizeGrade(initial.type, g) === normalizeGrade(initial.type, initial.grade)) ?? initial.grade;
  });
  const [target, setTarget] = useState(String(initial?.target ?? 50));
  const [year, setYear] = useState(initial?.year ?? thisYear);
  const [saving, setSaving] = useState(false);
  const clash = goals.find((g) => g.id !== initial?.id && g.year === year && g.type === type && normalizeGrade(g.type, g.grade) === normalizeGrade(type, grade));

  const years = Array.from(new Set([thisYear, thisYear + 1, ...(initial ? [initial.year] : [])])).sort((a, b) => a - b);
  const targetN = parseInt(target, 10);
  const targetOk = /^\d+$/.test(target) && targetN >= 1 && targetN <= 9999;
  const list = gradesFor(type);
  const grades = list.includes(grade) ? list : [grade, ...list];

  function pickType(t: ClimbType) {
    if (t === type) return;
    setType(t);
    setGrade(freeGrade(t, year, goals));
  }

  async function submit() {
    if (!targetOk || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/climbing/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, type, grade, target: targetN }) });
      if (!res.ok) throw new Error('save failed');
      const saved = await res.json().catch(() => null) as { id?: string } | null;
      // The upsert is keyed on year + type + grade, so a changed key is a new row: drop the old one.
      const keyChanged = !!initial?.id && (initial.year !== year || initial.type !== type || normalizeGrade(initial.type, initial.grade) !== normalizeGrade(type, grade));
      if (keyChanged && initial?.id && saved?.id !== initial.id) {
        const del = await fetch(`/api/climbing/goals?id=${encodeURIComponent(initial.id)}`, { method: 'DELETE' });
        if (!del.ok) show("Saved, but the old goal is still there. Delete it from its details.");
        else show('Goal saved');
      } else {
        show('Goal saved');
      }
      onClose();
      onSaved(year);
    } catch {
      show("Couldn't save the goal. Try again.");
      setSaving(false);
    }
  }

  const pill = (on: boolean) => on
    ? { background: 'var(--accent-fill)', borderColor: 'var(--accent-fill)', color: 'var(--on-accent-fill)' }
    : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' };

  return (
    <form className="space-y-4 pt-1" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div>
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type">
          {(['boulder', 'rope'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => pickType(t)} className="min-h-11 rounded-[10px] border text-[14px] font-medium" style={pill(type === t)}>
              {t === 'boulder' ? 'Boulder' : 'Rope'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Grade</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Grade">
          {grades.map((g) => (
            <button key={g} type="button" aria-pressed={g === grade} onClick={() => setGrade(g)} className="num min-h-11 min-w-11 rounded-[10px] border px-3 text-[14px] font-medium" style={pill(g === grade)}>
              {g}
            </button>
          ))}
        </div>
        {clash && (
          <p className="mt-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
            You already have a {clash.grade} goal ({clash.target}). Saving changes its target.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="gs-target">Target sends</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Target presets">
          {TARGETS.map((n) => (
            <button key={n} type="button" aria-pressed={target === String(n)} onClick={() => setTarget(String(n))} className="num min-h-11 min-w-14 rounded-[10px] border px-3 text-[14px] font-medium" style={pill(target === String(n))}>
              {n}
            </button>
          ))}
        </div>
        <Input id="gs-target" className="mt-2" type="number" inputMode="numeric" min={1} max={9999} placeholder="Or type a number" value={target} onChange={(e) => setTarget(e.target.value)} />
        {!targetOk && <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>Use a number from 1 to 9999.</p>}
      </div>

      <div>
        <Label htmlFor="gs-year">Year</Label>
        <Select id="gs-year" className="w-full" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={!targetOk || saving}>{saving ? 'Saving…' : clash ? 'Update goal' : 'Save goal'}</Button>
    </form>
  );
}
