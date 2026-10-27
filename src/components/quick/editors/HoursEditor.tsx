'use client';

import { useState } from 'react';
import SlotPainter from '../SlotPainter';
import { applyTemplate, templateKind } from '@/lib/quickDay';
import { hoursEntries } from '@/lib/quickApply';
import type { HoursEditorProps } from './types';

export default function HoursEditor({ date, payload, categories, onSave, submitLabel }: HoursEditorProps) {
  const kind = templateKind(date);
  const startedEmpty = !(payload.days[date]?.hours ?? []).some((h) => h !== null);
  const [hours, setHours] = useState<Array<number | null>>(() =>
    startedEmpty
      ? applyTemplate(payload.templates[kind], payload.ctx.categoryIds)
      : payload.days[date].hours,
  );

  function save() {
    onSave([
      {
        key: `hours:${date}`,
        url: '/api/time',
        method: 'POST',
        body: { date, entries: hoursEntries(hours) },
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {startedEmpty && payload.templates[kind] && <p className="subtle">Started from your {kind} template.</p>}
      {categories.length === 0 ? (
        <p className="subtle">Loading categories…</p>
      ) : (
        <SlotPainter value={hours} categories={categories} onChange={setHours} />
      )}
      <button type="button" className={`btn w-full ${submitLabel ? 'min-h-14 text-base font-semibold' : 'min-h-12'}`} onClick={save} disabled={hours.every((h) => h === null)}>
        {submitLabel ?? 'Looks right'}
      </button>
    </div>
  );
}
