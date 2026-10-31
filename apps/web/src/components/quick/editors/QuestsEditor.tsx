'use client';

import { useState } from 'react';
import type { QuestsEditorProps } from './types';

export default function QuestsEditor({ date, payload, quests, queued, onSave, submitLabel }: QuestsEditorProps) {
  const list = payload.ctx.sidequests.filter(
    (q) => (q.type === 'count' || q.type === 'timed') && !q.completedAt && q.year === payload.ctx.year,
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of list) {
      const body = queued(`sq:${date}:${q.id}`) as { value?: number } | undefined;
      const saved = payload.days[date]?.sidequestValues?.[q.id];
      if (body && typeof body.value === 'number') init[q.id] = String(body.value);
      else if (typeof saved === 'number') init[q.id] = String(saved);
    }
    return init;
  });

  const parsed = list
    .map((q) => ({ id: q.id, value: parseFloat((values[q.id] ?? '').replace(',', '.')) }))
    .filter((x) => Number.isFinite(x.value));

  function save() {
    onSave(
      parsed.map((x) => ({
        key: `sq:${date}:${x.id}`,
        url: `/api/sidequests/${x.id}?action=log`,
        method: 'POST' as const,
        body: { date, value: x.value, replace: true },
      })),
    );
  }

  return (
    <div className="space-y-3">
      {list.map((q) => {
        const info = quests[q.id];
        return (
          <label key={q.id} className="block">
            <span className="subtle">
              {info?.title ?? 'Side quest'}
              {info?.unit ? ` (${info.unit})` : ''}
            </span>
            <input
              className="input mt-1 min-h-12 w-full text-lg"
              type="text"
              inputMode="decimal"
              value={values[q.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [q.id]: e.target.value }))}
            />
          </label>
        );
      })}
      {list.length === 0 && <p className="subtle">No active side quests.</p>}
      <button type="button" className="btn min-h-12 w-full" disabled={parsed.length === 0} onClick={save}>
        {submitLabel ?? 'Save'}
      </button>
    </div>
  );
}
