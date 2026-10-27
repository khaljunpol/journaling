"use client";

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { fieldBase, fieldClass } from '@/components/ui/Input';
import type { Sidequest, SidequestMilestone, SidequestType } from '@/lib/types';

const TYPE_OPTIONS: { value: SidequestType; label: string; desc: string }[] = [
  { value: 'oneoff', label: 'One-off', desc: 'A single task to complete' },
  { value: 'milestone', label: 'Milestones', desc: 'Ordered checkpoints to unlock' },
  { value: 'pb', label: 'Personal Best', desc: 'Track a record (e.g. max reps)' },
  { value: 'timed', label: 'Timed', desc: 'Time-based records (min:sec)' },
  { value: 'count', label: 'Count', desc: 'Reach a target number of times' },
];

interface Props {
  initial?: Partial<Sidequest>;
  onSubmit: (data: Partial<Sidequest>) => Promise<void>;
  onCancel: () => void;
}

export default function SidequestForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [type, setType] = useState<SidequestType>(initial?.type || 'oneoff');
  const [unit, setUnit] = useState(initial?.unit || '');
  const [target, setTarget] = useState(initial?.target != null ? String(initial.target) : '');
  const [description, setDescription] = useState(initial?.description || '');
  const [year, setYear] = useState(initial?.year || new Date().getFullYear());
  const [milestones, setMilestones] = useState<SidequestMilestone[]>(
    initial?.milestones || [{ label: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addMilestone() {
    setMilestones((prev) => [...prev, { label: '' }]);
  }

  function removeMilestone(i: number) {
    setMilestones((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateMilestone(i: number, label: string) {
    setMilestones((prev) => prev.map((m, idx) => idx === i ? { ...m, label } : m));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const data: Partial<Sidequest> = { title: t, type, year, description: description.trim() || undefined };
      if (type === 'milestone') {
        data.milestones = milestones.filter((m) => m.label.trim()).map((m) => ({ label: m.label.trim() }));
      }
      if (type === 'pb' || type === 'count') {
        data.unit = unit.trim() || undefined;
        data.target = target ? parseFloat(target) || undefined : undefined;
      }
      if (type === 'timed') {
        data.unit = 'sec';
        data.target = target ? parseFloat(target) || undefined : undefined;
      }
      await onSubmit(data);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const labelCls = 'block text-[12px] font-medium mb-1 uppercase tracking-[0.04em]';
  const inputCls = fieldClass;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className={labelCls} style={{ color: 'var(--text-3)' }}>Title *</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Weighted pull-ups, Run 5K sub-25min…"
          maxLength={120}
          autoFocus
        />
      </div>

      {/* Year */}
      <div>
        <label className={labelCls} style={{ color: 'var(--text-3)' }}>Year</label>
        <input
          type="number"
          className={inputCls}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
          min={2020} max={2035}
        />
      </div>

      {/* Type */}
      <div>
        <label className={labelCls} style={{ color: 'var(--text-3)' }}>Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className="min-h-11 rounded-[10px] border px-3 py-2 text-left"
              style={{
                borderColor: type === opt.value ? 'var(--accent)' : 'var(--border)',
                background: type === opt.value ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : 'var(--surface-2)',
                color: type === opt.value ? 'var(--accent)' : 'var(--text-1)',
              }}
            >
              <div className="text-xs font-semibold">{opt.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Milestones */}
      {type === 'milestone' && (
        <div>
          <label className={labelCls} style={{ color: 'var(--text-3)' }}>Milestones (in order)</label>
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs tabular-nums w-5 text-right" style={{ color: 'var(--text-2)' }}>{i + 1}.</span>
                <input
                  className={inputCls + ' flex-1'}
                  value={m.label}
                  onChange={(e) => updateMilestone(i, e.target.value)}
                  placeholder={`Milestone ${i + 1}`}
                  maxLength={80}
                />
                {milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    aria-label={`Remove milestone ${i + 1}`}
                    className="flex h-11 w-11 items-center justify-center rounded-[10px] text-xs hover:bg-[var(--surface-2)]"
                    style={{ color: 'var(--text-2)' }}
                  >✕</button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addMilestone}
              className="min-h-11 rounded-[10px] border px-3 text-xs hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
            >+ Add milestone</button>
          </div>
        </div>
      )}

      {/* Unit for pb / count */}
      {(type === 'pb' || type === 'count') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={{ color: 'var(--text-3)' }}>Unit</label>
            <input
              className={inputCls}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={type === 'pb' ? 'kg, reps, m…' : 'sessions, pages…'}
              maxLength={32}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--text-3)' }}>Target {unit ? `(${unit})` : ''}</label>
            <input
              type="number"
              className={inputCls}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Optional goal"
              min={0} step="any"
            />
          </div>
        </div>
      )}

      {/* Target time for timed */}
      {type === 'timed' && (
        <div>
          <label className={labelCls} style={{ color: 'var(--text-3)' }}>Target time (seconds, optional)</label>
          <input
            type="number"
            className={inputCls}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 300 for 5 min"
            min={0}
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label className={labelCls} style={{ color: 'var(--text-3)' }}>Notes / description</label>
        <textarea
          className={`${fieldBase} w-full resize-none px-3 py-2`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any extra context…"
          rows={2}
          maxLength={500}
        />
      </div>

      {error && <p role="alert" className="text-[13px]" style={{ color: 'var(--warn)' }}>{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : (initial?.id ? 'Save changes' : 'Create sidequest')}</Button>
      </div>
    </form>
  );
}
